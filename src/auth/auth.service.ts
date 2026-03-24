import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as ldap from 'ldapjs';

type LdapUser = {
  dn: string;
  sAMAccountName?: string;
  displayName?: string;
  mail?: string;
  userPrincipalName?: string;
  company?: string;
  department?: string;
  telephoneNumber?: string;
};

@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService) {}

  private readonly url = process.env.AD_URL!;
  private readonly baseDn = process.env.AD_BASE_DN!;

  private readonly serviceBindIdentity = (
    process.env.AD_BIND_IDENTITY || ''
  ).trim();
  private readonly serviceBindPassword = (
    process.env.AD_BIND_PASSWORD || ''
  ).trim();

  private readonly accessSecret = process.env.JWT_ACCESS_SECRET!;
  private readonly accessTtl = Number(process.env.JWT_ACCESS_TTL || 900); // 15 min

  async verifyAccessToken(token: string) {
    try {
      // retorna o payload que você colocou no login()
      return await this.jwt.verifyAsync(token, { secret: this.accessSecret });
    } catch {
      throw new UnauthorizedException('Token inválido');
    }
  }

  private createClient(): ldap.Client {
    const options: ldap.ClientOptions = {
      url: this.url,
      timeout: 30000,
      connectTimeout: 30000,
      reconnect: false,
    };

    if (this.url.startsWith('ldaps://')) {
      // Em produção, ideal é confiar na CA (NODE_EXTRA_CA_CERTS) e NÃO desabilitar validação
      options.tlsOptions = { rejectUnauthorized: false };
    }

    const client = ldap.createClient(options);

    client.on('error', (err: any) => {
      if (err?.code === 'ECONNRESET') return;
      // console.error('[LDAP] client error:', err);
    });

    return client;
  }

  private safeClose(client: ldap.Client) {
    try {
      client.unbind();
    } catch {}
    try {
      client.destroy();
    } catch {}
  }

  private bind(
    client: ldap.Client,
    identity: string,
    password: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      client.bind(identity, password, (err) => (err ? reject(err) : resolve()));
    });
  }

  private escapeFilter(v: string): string {
    return String(v)
      .replace(/\\/g, '\\5c')
      .replace(/\*/g, '\\2a')
      .replace(/\(/g, '\\28')
      .replace(/\)/g, '\\29')
      .replace(/\0/g, '\\00');
  }

  private findUserBySam(client: ldap.Client, sam: string): Promise<LdapUser> {
    const samEscaped = this.escapeFilter(sam);

    const options: ldap.SearchOptions = {
      scope: 'sub',
      filter: `(&(objectClass=user)(sAMAccountName=${samEscaped}))`,
      attributes: [
        'sAMAccountName',
        'displayName',
        'mail',
        'userPrincipalName',
        'company',
        'department',
        'telephoneNumber',
      ],
      sizeLimit: 1,
    };

    return new Promise((resolve, reject) => {
      let found: LdapUser | null = null;

      client.search(this.baseDn, options, (err, res) => {
        if (err) return reject(err);

        res.on('searchEntry', (entry: any) => {
          // DN
          const dn =
            entry?.dn?.toString?.() ||
            entry?.objectName ||
            entry?.pojo?.objectName ||
            entry?.object?.distinguishedName ||
            entry?.pojo?.object?.distinguishedName ||
            null;

          // Atributos (forma confiável)
          const attrs = entry?.pojo?.attributes || [];
          const getAttr = (name: string): string | undefined => {
            const a = attrs.find(
              (x: any) => String(x.type).toLowerCase() === name.toLowerCase(),
            );
            const v = a?.values?.[0];
            return v != null ? String(v) : undefined;
          };

          // fallback: se vier em entry.object
          const obj = entry.object ?? entry.pojo?.object ?? {};

          found = {
            dn,
            sAMAccountName: getAttr('sAMAccountName') ?? obj.sAMAccountName,
            displayName: getAttr('displayName') ?? obj.displayName,
            mail: getAttr('mail') ?? obj.mail,
            userPrincipalName:
              getAttr('userPrincipalName') ?? obj.userPrincipalName,
            company: getAttr('company') ?? obj.company,
            department: getAttr('department') ?? obj.department,
            telephoneNumber: getAttr('telephoneNumber') ?? obj.telephoneNumber,
          };
        });

        res.on('error', reject);
        res.on('end', () => {
          if (!found?.dn) {
            return reject(
              new Error(`Usuário encontrado mas DN não veio. sam=${sam}`),
            );
          }
          resolve(found);
        });
      });
    });
  }

  async validateUser(sam: string, password: string): Promise<any> {
    const client = this.createClient();

    try {
      await this.bind(
        client,
        this.serviceBindIdentity,
        this.serviceBindPassword,
      );

      const user = await this.findUserBySam(client, sam);

      await this.bind(client, user.dn, password);

      // volta para conta de serviço
      await this.bind(
        client,
        this.serviceBindIdentity,
        this.serviceBindPassword,
      );

      const groups = await this.getUserGroupsByDn(client, user.dn);

      return { ...user, groups };
    } catch {
      throw new UnauthorizedException('Usuário ou senha inválidos');
    } finally {
      this.safeClose(client);
    }
  }

  async login(body: { username: string; password: string }) {
    const sam = (body.username || '').trim();
    const password = body.password ?? '';

    if (!sam || !password) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const adUser = await this.validateUser(sam, password);

    const roles = this.mapGroupsToRoles(adUser.groups);

    const payload = {
      sub: adUser.sAMAccountName,
      sam: adUser.sAMAccountName,
      name: adUser.displayName,
      mail: adUser.mail,
      company: adUser.company,
      department: adUser.department,
      telephoneNumber: adUser.telephoneNumber,
      roles,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.accessSecret,
      expiresIn: this.accessTtl,
    });

    return accessToken;
  }

  private extractCn(dn: string): string {
    const match = dn.match(/CN=([^,]+)/i);
    return match?.[1]?.trim() ?? '';
  }

  private mapGroupsToRoles(groupsDn: string[]): string[] {
    const roles = new Set<string>();

    const groupRoleMap: Record<string, string> = {
      Sistema_Interno_Pizzatto_Admin: 'ADMIN',
      Sistema_Interno_Pizzatto_Colaborador: 'COLABORADOR',
      Sistema_Interno_Pizzatto_EndoMarketing: 'ENDOMARKETING',
      Sistema_Interno_Pizzatto_Lideranca: 'LIDERANCA',
      Sistema_Interno_Pizzatto_Pessoas_e_Cultura: 'PESSOAS_E_CULTURA',
      Sistema_Interno_Pizzatto_TI: 'TI',
    };

    for (const dn of groupsDn) {
      const cn = this.extractCn(dn);

      const role = Object.entries(groupRoleMap).find(
        ([groupName]) => groupName.toLowerCase() === cn.toLowerCase(),
      )?.[1];

      if (role) {
        roles.add(role);
      }
    }

    // fallback mínimo
    if (roles.size === 0) {
      roles.add('USER');
    }

    return Array.from(roles);
  }

  private async getUserGroupsByDn(
    client: ldap.Client,
    userDn: string,
  ): Promise<string[]> {
    const options: ldap.SearchOptions = {
      scope: 'base',
      filter: '(objectClass=*)',
      attributes: ['memberOf'],
      sizeLimit: 1,
    };

    return new Promise((resolve, reject) => {
      let groups: string[] = [];

      client.search(userDn, options, (err, res) => {
        if (err) return reject(err);

        res.on('searchEntry', (entry: any) => {
          const obj = entry.object ?? entry.pojo?.object ?? {};

          const mo = obj.memberOf;

          if (mo) groups = Array.isArray(mo) ? mo : [mo];

          if ((!mo || groups.length === 0) && entry?.pojo?.attributes) {
            const attrs = entry.pojo.attributes || [];
            const a = attrs.find(
              (x: any) => String(x.type).toLowerCase() === 'memberof',
            );
            if (a?.values?.length) groups = a.values.map((v: any) => String(v));
          }
        });

        res.on('error', reject);
        res.on('end', () => resolve(groups));
      });
    });
  }

  async logout(_sub: string) {
    return { ok: true };
  }
}

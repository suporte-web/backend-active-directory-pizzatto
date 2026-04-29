import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as ldap from 'ldapjs';

type LdapUser = {
  adObjectGuid: string;
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
  private readonly accessTtl = Number(process.env.JWT_ACCESS_TTL || 900);

  async verifyAccessToken(token: string) {
    try {
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
      options.tlsOptions = { rejectUnauthorized: false };
    }

    const client = ldap.createClient(options);

    client.on('error', (err: any) => {
      if (err?.code === 'ECONNRESET') return;
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

  private bufferToGuid(buffer: Buffer): string {
    if (buffer.length !== 16) {
      throw new Error(`objectGUID inválido: tamanho ${buffer.length}`);
    }

    const hex = buffer.toString('hex');

    return [
      hex.slice(6, 8) + hex.slice(4, 6) + hex.slice(2, 4) + hex.slice(0, 2),
      hex.slice(10, 12) + hex.slice(8, 10),
      hex.slice(14, 16) + hex.slice(12, 14),
      hex.slice(16, 20),
      hex.slice(20, 32),
    ].join('-');
  }

  private getBinaryAttributeFromEntry(entry: any, attrName: string): Buffer | undefined {
    const normalized = attrName.toLowerCase();

    const attrs = entry?.attributes ?? [];
    for (const attr of attrs) {
      const type = String(attr?.type || '').toLowerCase();

      if (type === normalized || type === `${normalized};binary`) {
        if (Array.isArray(attr?.buffers) && attr.buffers.length > 0) {
          const first = attr.buffers[0];
          if (Buffer.isBuffer(first)) {
            return first;
          }
        }

        if (Array.isArray(attr?._vals) && attr._vals.length > 0) {
          const first = attr._vals[0];
          if (Buffer.isBuffer(first)) {
            return first;
          }
        }
      }
    }

    const pojoAttrs = entry?.pojo?.attributes ?? [];
    for (const attr of pojoAttrs) {
      const type = String(attr?.type || '').toLowerCase();

      if (type === normalized || type === `${normalized};binary`) {
        const values = attr?.values ?? [];
        if (values.length > 0) {
          const first = values[0];

          if (Buffer.isBuffer(first)) {
            return first;
          }

          if (
            first &&
            typeof first === 'object' &&
            first.type === 'Buffer' &&
            Array.isArray(first.data)
          ) {
            return Buffer.from(first.data);
          }
        }
      }
    }

    return undefined;
  }

  private getStringAttributeFromEntry(entry: any, attrName: string): string | undefined {
    const normalized = attrName.toLowerCase();

    const pojoAttrs = entry?.pojo?.attributes ?? [];
    for (const attr of pojoAttrs) {
      const type = String(attr?.type || '').toLowerCase();

      if (type === normalized) {
        const values = attr?.values ?? [];
        if (!values.length) return undefined;

        const first = values[0];

        if (Buffer.isBuffer(first)) {
          return first.toString('utf8');
        }

        if (
          first &&
          typeof first === 'object' &&
          first.type === 'Buffer' &&
          Array.isArray(first.data)
        ) {
          return Buffer.from(first.data).toString('utf8');
        }

        return String(first);
      }
    }

    const obj = entry?.object ?? entry?.pojo?.object ?? {};
    const value = obj[attrName];
    return value != null ? String(value) : undefined;
  }

  private findUserBySam(client: ldap.Client, sam: string): Promise<LdapUser> {
    const samEscaped = this.escapeFilter(sam);

    const options: ldap.SearchOptions = {
      scope: 'sub',
      filter: `(&(objectClass=user)(sAMAccountName=${samEscaped}))`,
      attributes: [
        'objectGUID;binary',
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
          const dn =
            entry?.dn?.toString?.() ||
            entry?.objectName ||
            entry?.pojo?.objectName ||
            entry?.object?.distinguishedName ||
            entry?.pojo?.object?.distinguishedName ||
            null;

          const guidBuffer =
            this.getBinaryAttributeFromEntry(entry, 'objectGUID') ??
            this.getBinaryAttributeFromEntry(entry, 'objectGUID;binary');

          const adObjectGuid = guidBuffer
            ? this.bufferToGuid(guidBuffer)
            : '';

          found = {
            adObjectGuid,
            dn,
            sAMAccountName: this.getStringAttributeFromEntry(entry, 'sAMAccountName'),
            displayName: this.getStringAttributeFromEntry(entry, 'displayName'),
            mail: this.getStringAttributeFromEntry(entry, 'mail'),
            userPrincipalName: this.getStringAttributeFromEntry(entry, 'userPrincipalName'),
            company: this.getStringAttributeFromEntry(entry, 'company'),
            department: this.getStringAttributeFromEntry(entry, 'department'),
            telephoneNumber: this.getStringAttributeFromEntry(entry, 'telephoneNumber'),
          };
        });

        res.on('error', reject);
        res.on('end', () => {
          if (!found?.dn) {
            return reject(
              new Error(`Usuário encontrado mas DN não veio. sam=${sam}`),
            );
          }

          if (!found.adObjectGuid) {
            return reject(
              new Error(
                `Usuário encontrado mas objectGUID não veio em formato binário. sam=${sam}`,
              ),
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
      adObjectGuid: adUser.adObjectGuid,
      sub: adUser.sAMAccountName,
      sam: adUser.sAMAccountName,
      name: adUser.displayName,
      mail: adUser.mail,
      company: adUser.company,
      department: adUser.department,
      telephoneNumber: adUser.telephoneNumber,
      roles,
    };

    return this.jwt.signAsync(payload, {
      secret: this.accessSecret,
      expiresIn: this.accessTtl,
    });
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
      Sistema_Interno_Pizzatto_Desenvolvimento: 'DESENVOLVIMENTO',
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

          if (mo) {
            groups = Array.isArray(mo) ? mo : [mo];
          }

          if ((!mo || groups.length === 0) && entry?.pojo?.attributes) {
            const attrs = entry.pojo.attributes || [];
            const attr = attrs.find(
              (x: any) => String(x.type).toLowerCase() === 'memberof',
            );

            if (attr?.values?.length) {
              groups = attr.values.map((v: any) => String(v));
            }
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
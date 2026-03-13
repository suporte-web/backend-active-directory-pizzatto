import { Injectable, InternalServerErrorException } from '@nestjs/common';
// import { InjectModel } from '@nestjs/mongoose';
// import { Model } from 'mongoose';
// import { User } from 'src/user/user.model';
import * as ldap from 'ldapjs';

@Injectable()
export class UserAdService {
  constructor(
    // @InjectModel('UserAd') private readonly userAdModel: Model<User>,
  ) {}

  // ====== ENV ======
  private readonly url = process.env.AD_URL!;
  private readonly bindIdentity = (process.env.AD_BIND_IDENTITY || '').trim();
  private readonly bindPassword = (process.env.AD_BIND_PASSWORD || '')
    .replace(/\r/g, '')
    .replace(/\n/g, '')
    .trim();

  // ====== CONSTANTS ======
  private readonly BASE_DN = 'DC=pizzatto,DC=local';
  private readonly UPN_SUFFIX = 'pizzatto.local';

  // (Opcional) limite de grupos que podem ser gerenciados pelo app (evita mexer em grupos protegidos)
  // private readonly ALLOWED_GROUP_DN_CONTAINS = 'OU=Security Groups,DC=pizzatto,DC=local';

  // ====== CLIENT ======
  private createClient(): ldap.Client {
    const options: ldap.ClientOptions = {
      url: this.url,
      timeout: 30000,
      connectTimeout: 30000,
      reconnect: false,
    };

    // ⚠️ Aceita certificado self-signed (use só em ambiente controlado)
    if (this.url.startsWith('ldaps://')) {
      options.tlsOptions = {
        rejectUnauthorized: false,
      };
    }

    const client = ldap.createClient(options);

    client.on('error', (err) => {
      console.error('[LDAP] client error (evento):', err);
    });

    return client;
  }

  private async bind(client: ldap.Client): Promise<void> {
    return new Promise((resolve, reject) => {
      client.bind(this.bindIdentity, this.bindPassword, (err) => {
        if (err) {
          console.error(
            '[LDAP][bind] err raw:',
            JSON.stringify(err, Object.getOwnPropertyNames(err), 2),
          );
          return reject(err);
        }
        resolve();
      });
    });
  }

  private safeUnbind(client: ldap.Client) {
    try {
      client.unbind();
    } catch {}
    try {
      client.destroy();
    } catch {}
  }

  // ====== HELPERS ======
  // Escape básico pra filtro LDAP (evita quebrar filtro com chars especiais)
  private escapeFilter(v: string): string {
    return String(v)
      .replace(/\\/g, '\\5c')
      .replace(/\*/g, '\\2a')
      .replace(/\(/g, '\\28')
      .replace(/\)/g, '\\29')
      .replace(/\0/g, '\\00');
  }

  private bufferToGuid(buffer: Buffer): string {
    const hex = buffer.toString('hex');
    return [
      hex.substr(6, 2) + hex.substr(4, 2) + hex.substr(2, 2) + hex.substr(0, 2),
      hex.substr(10, 2) + hex.substr(8, 2),
      hex.substr(14, 2) + hex.substr(12, 2),
      hex.substr(16, 4),
      hex.substr(20),
    ].join('-');
  }

  // (Opcional) restringe grupos que você permite mexer
  // private isGroupAllowed(groupDn: string): boolean {
  //   return groupDn.toLowerCase().includes(this.ALLOWED_GROUP_DN_CONTAINS.toLowerCase());
  // }

  // ====== LDAP OPS ======
  private add(
    client: ldap.Client,
    dn: string,
    entry: ldap.Attributes,
  ): Promise<void> {
    const safeDn = this.normalizeDn(dn);
    return new Promise((resolve, reject) => {
      client.add(safeDn, entry, (err) => (err ? reject(err) : resolve()));
    });
  }

  private modify(client: ldap.Client, dn: string, change: any): Promise<void> {
    const safeDn = this.normalizeDn(dn);

    console.log('[LDAP][modify] dn=', safeDn);

    return new Promise((resolve, reject) => {
      client.modify(safeDn, change, (err) => {
        console.log(
          '[LDAP][modify] callback err=',
          err?.name || null,
          err?.message || null,
        );
        if (err) return reject(err);
        resolve();
      });
    });
  }

  private async setPassword(
    client: ldap.Client,
    dn: string,
    password: string,
  ): Promise<void> {
    const newPassword = `"${password}"`;
    const passwordBuffer = Buffer.from(newPassword, 'utf16le');

    const AttributeCtor = (ldap as any).Attribute;
    const ChangeCtor = (ldap as any).Change;

    const pwdAttr = new AttributeCtor({
      type: 'unicodePwd',
      values: [passwordBuffer],
    });

    const change = new ChangeCtor({
      operation: 'replace',
      modification: pwdAttr,
    });

    await this.modify(client, dn, change);
  }

  private async forcePasswordChange(
    client: ldap.Client,
    dn: string,
  ): Promise<void> {
    const AttributeCtor = (ldap as any).Attribute;
    const ChangeCtor = (ldap as any).Change;

    const pwdLastSetAttr = new AttributeCtor({
      type: 'pwdLastSet',
      values: ['0'],
    });

    const change = new ChangeCtor({
      operation: 'replace',
      modification: pwdLastSetAttr,
    });

    await this.modify(client, dn, change);
  }

  // private async setResetPassword(
  //   client: ldap.Client,
  //   dn: string,
  //   password: string,
  // ): Promise<void> {
  //   const passwordBuffer = Buffer.from(`"${password}"`, 'utf16le');

  //   const AttributeCtor = (ldap as any).Attribute;
  //   const ChangeCtor = (ldap as any).Change;

  //   // ✅ crie o Attribute e adicione valor via método
  //   const attr = new AttributeCtor({ type: 'unicodePwd' });
  //   attr.addValue(passwordBuffer);

  //   const change = new ChangeCtor({
  //     operation: 'replace',
  //     modification: attr,
  //   });

  //   // ✅ passe como array (muito mais compatível)
  //   await new Promise<void>((resolve, reject) => {
  //     client.modify(dn, [change], (err) => (err ? reject(err) : resolve()));
  //   });
  // }

  // private async getRootDseInfo(client: ldap.Client): Promise<any> {
  //   const opts: ldap.SearchOptions = {
  //     scope: 'base',
  //     filter: '(objectClass=*)',
  //     attributes: [
  //       'defaultNamingContext',
  //       'dnsHostName',
  //       'ldapServiceName',
  //       'serverName',
  //       'isGlobalCatalogReady',
  //     ],
  //   };

  //   return new Promise((resolve, reject) => {
  //     client.search('', opts, (err, res) => {
  //       if (err) return reject(err);

  //       let obj: any = null;

  //       res.on('searchEntry', (entry: any) => {
  //         // ✅ alguns builds trazem entry.pojo.object
  //         obj = entry.object ?? entry.pojo?.object ?? entry.pojo ?? entry;
  //       });

  //       res.on('error', reject);
  //       res.on('end', () => resolve(obj));
  //     });
  //   });
  // }

  // private async forceResetPasswordChange(
  //   client: ldap.Client,
  //   dn: string,
  // ): Promise<void> {
  //   const AttributeCtor = (ldap as any).Attribute;
  //   const ChangeCtor = (ldap as any).Change;

  //   const attr = new AttributeCtor({ type: 'pwdLastSet' });
  //   attr.addValue('0');

  //   const change = new ChangeCtor({
  //     operation: 'replace',
  //     modification: attr,
  //   });

  //   await new Promise<void>((resolve, reject) => {
  //     client.modify(dn, [change], (err) => (err ? reject(err) : resolve()));
  //   });
  // }

  private async enableAccount(client: ldap.Client, dn: string): Promise<void> {
    const AttributeCtor = (ldap as any).Attribute;
    const ChangeCtor = (ldap as any).Change;

    const uacAttr = new AttributeCtor({
      type: 'userAccountControl',
      values: ['512'], // NORMAL_ACCOUNT
    });

    const change = new ChangeCtor({
      operation: 'replace',
      modification: uacAttr,
    });

    await this.modify(client, dn, change);
  }

  private async findUserDnBySam(
    client: ldap.Client,
    sam: string,
  ): Promise<string> {
    const samEscaped = this.escapeFilter(sam);

    const options: ldap.SearchOptions = {
      scope: 'sub',
      filter: `(&(objectClass=user)(sAMAccountName=${samEscaped}))`,
      // você nem precisa pedir distinguishedName; o DN vem no entry.dn
      attributes: ['cn'],
      sizeLimit: 1,
    };

    return new Promise((resolve, reject) => {
      let foundDn: string | null = null;

      client.search(this.BASE_DN, options, (err, res) => {
        if (err) return reject(err);

        res.on('searchEntry', (entry: any) => {
          // 👇 DN “de verdade”
          foundDn = entry?.dn?.toString?.() ?? entry?.pojo?.objectName ?? null;
        });

        res.on('error', reject);
        res.on('end', () => {
          if (!foundDn)
            return reject(new Error(`Usuário ${sam} não encontrado no AD`));
          resolve(foundDn);
        });
      });
    });
  }

  // private async getUserMemberOfBySam(
  //   client: ldap.Client,
  //   sam: string,
  // ): Promise<string[]> {
  //   const samEscaped = this.escapeFilter(sam);

  //   const options: ldap.SearchOptions = {
  //     scope: 'sub',
  //     filter: `(&(objectClass=user)(sAMAccountName=${samEscaped}))`,
  //     attributes: ['memberOf'],
  //     sizeLimit: 1,
  //   };

  //   return new Promise((resolve, reject) => {
  //     const memberOf: string[] = [];

  //     client.search(this.BASE_DN, options, (err, res) => {
  //       if (err) return reject(err);

  //       res.on('searchEntry', (entry: any) => {
  //         const attrs = entry.pojo.attributes || [];
  //         const mo = attrs.find((a: any) => a.type === 'memberOf');
  //         if (mo?.values?.length) memberOf.push(...mo.values);
  //       });

  //       res.on('error', reject);
  //       res.on('end', () => resolve(memberOf));
  //     });
  //   });
  // }

  private isAlreadyInGroupError(err: any): boolean {
    const name = err?.name || '';
    const msg = (err?.lde_message || err?.message || '').toLowerCase();
    const code = err?.code;

    // cobre variações de server/ldapjs
    return (
      name === 'EntryAlreadyExistsError' ||
      name === 'AttributeOrValueExistsError' ||
      name === 'TypeOrValueExistsError' ||
      code === 68 || // LDAP_ALREADY_EXISTS
      code === 20 || // LDAP_TYPE_OR_VALUE_EXISTS
      msg.includes('already exists') ||
      msg.includes('value exists')
    );
  }

  private isNotMemberError(err: any): boolean {
    const name = err?.name || '';
    const msg = (err?.lde_message || err?.message || '').toLowerCase();
    const code = err?.code;

    return (
      name === 'NoSuchAttributeError' ||
      code === 16 ||
      msg.includes('no such attribute')
    );
  }

  private async modifyGroupMembership(
    client: ldap.Client,
    groupDn: string,
    userDn: string,
    op: 'add' | 'delete',
  ): Promise<void> {
    if (!groupDn) throw new Error('groupDn vazio em modifyGroupMembership');
    if (!userDn) throw new Error('userDn vazio em modifyGroupMembership');

    const AttributeCtor = (ldap as any).Attribute;
    const ChangeCtor = (ldap as any).Change;

    const attr = new AttributeCtor({
      type: 'member',
      values: [userDn],
    });

    const change = new ChangeCtor({
      operation: op,
      modification: attr,
    });

    try {
      await this.modify(client, groupDn, change);
    } catch (err: any) {
      if (op === 'add' && this.isAlreadyInGroupError(err)) {
        console.log(
          '[LDAP] usuário já era membro do grupo, ignorando:',
          groupDn,
        );
        return;
      }
      if (op === 'delete' && this.isNotMemberError(err)) {
        console.log(
          '[LDAP] usuário não era membro do grupo, ignorando:',
          groupDn,
        );
        return;
      }
      throw err;
    }
  }

  // ====== PUBLIC METHODS ======
  async createUser(dto: any): Promise<void> {
    const client = this.createClient();

    try {
      await this.bind(client);

      const firstName = dto.primeiroNome;
      const lastName = dto.sobrenome;
      const username = dto.username;
      const ouPath = dto.ouPath;

      // ⚠️ Ideal: gerar senha segura e não reutilizar bindPassword
      const password = process.env.AD_BIND_PASSWORD as string;

      const cn = `${firstName} ${lastName}`;
      const dn = `CN=${cn},${ouPath}`;

      const entry: ldap.Attributes = {
        cn,
        sn: lastName,
        givenName: firstName,
        displayName: cn,
        sAMAccountName: username,
        userPrincipalName: `${username}@${this.UPN_SUFFIX}`,
        objectClass: ['top', 'person', 'organizationalPerson', 'user'],
      };

      if (dto.email) (entry as any).mail = dto.email;

      await this.add(client, dn, entry);
      await this.setPassword(client, dn, password);
      await this.enableAccount(client, dn);
      await this.forcePasswordChange(client, dn);

      // opcional: salvar no Mongo
      // await this.userAdModel.create({ username, firstName, lastName, ouPath });
    } catch (error) {
      console.error('[createUser] erro:', error);
      throw new InternalServerErrorException(
        'Erro ao criar usuário no Active Directory',
      );
    } finally {
      this.safeUnbind(client);
    }
  }

  async getAllUsers(): Promise<any[]> {
    const client = this.createClient();

    try {
      await this.bind(client);

      const options: ldap.SearchOptions = {
        scope: 'sub',
        filter:
          '(&(objectCategory=person)(objectClass=user)(!(objectClass=computer)))',
        attributes: [
          'cn',
          'sn',
          'givenName',
          'displayName',
          'sAMAccountName',
          'userPrincipalName',
          'mail',
          'distinguishedName',
          'userAccountControl',
          'objectGUID',
          'memberOf',
        ],
        paged: {
          pageSize: 1000,
          pagePause: false,
        },
      };

      return await new Promise((resolve, reject) => {
        const users: any[] = [];

        client.search(this.BASE_DN, options, (err, res) => {
          if (err) return reject(err);

          res.on('searchEntry', (entry: any) => {
            const attrs = entry.pojo.attributes || [];
            const attrMap: Record<string, string | string[]> = {};

            for (const attr of attrs) {
              if (!attr.values || attr.values.length === 0) continue;
              attrMap[attr.type] =
                attr.values.length === 1 ? attr.values[0] : attr.values;
            }

            let objectGUID: string | null = null;
            if (attrMap['objectGUID']) {
              const raw = attrMap['objectGUID'];
              const buffer = Array.isArray(raw) ? raw[0] : raw;
              objectGUID = this.bufferToGuid(Buffer.from(buffer, 'binary'));
            }

            const uacRaw = attrMap['userAccountControl'];
            const uac = uacRaw ? parseInt(uacRaw as string, 10) : 0;
            const isDisabled = (uac & 2) === 2;

            const memberOfRaw = attrMap['memberOf'];
            const memberOf: string[] = !memberOfRaw
              ? []
              : Array.isArray(memberOfRaw)
                ? memberOfRaw
                : [memberOfRaw];

            users.push({
              dn: entry.pojo.objectName ?? null,
              cn: (attrMap['cn'] as string) ?? null,
              sn: (attrMap['sn'] as string) ?? null,
              givenName: (attrMap['givenName'] as string) ?? null,
              displayName: (attrMap['displayName'] as string) ?? null,
              sAMAccountName: (attrMap['sAMAccountName'] as string) ?? null,
              userPrincipalName:
                (attrMap['userPrincipalName'] as string) ?? null,
              mail: (attrMap['mail'] as string) ?? null,
              distinguishedName:
                (attrMap['distinguishedName'] as string) ??
                (entry.pojo.objectName as string) ??
                null,
              userAccountControl: uac,
              isDisabled,
              objectGUID,
              memberOf,
            });
          });

          client.on('error', (err: any) => {
            if (err?.code === 'ECONNRESET') return; // ruído comum em LDAPS
            console.error('[LDAP] client error (evento):', err);
          });

          res.on('end', () => resolve(users));
        });
      });
    } catch (error) {
      console.error('[getAllUsers] erro:', error);
      throw new InternalServerErrorException(
        'Erro ao buscar usuários no Active Directory',
      );
    } finally {
      this.safeUnbind(client);
    }
  }

  async getUsersPaginated(body: any) {
    const { page, limit, pesquisa, isDisabled } = body;

    const allUsers = await this.getAllUsers();

    let filtered = allUsers;

    if (pesquisa && pesquisa.trim()) {
      const term = pesquisa.trim().toLowerCase();
      filtered = filtered.filter((u: any) => {
        const fieldsToSearch = [
          u.cn,
          u.displayName,
          u.sAMAccountName,
          u.userPrincipalName,
          u.mail,
          u.distinguishedName,
        ];
        return fieldsToSearch.some((field) =>
          field ? String(field).toLowerCase().includes(term) : false,
        );
      });
    }

    if (typeof isDisabled === 'boolean') {
      filtered = filtered.filter((u: any) => u.isDisabled === isDisabled);
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit);
    const currentPage = Math.max(1, Math.min(page, totalPages || 1));

    const start = (currentPage - 1) * limit;
    const end = start + limit;

    const data = filtered.slice(start, end);

    return { data, total, page: currentPage, limit, totalPages };
  }

  async getAllGroups(): Promise<any[]> {
    const client = this.createClient();

    try {
      await this.bind(client);

      const options: ldap.SearchOptions = {
        scope: 'sub',
        filter: '(objectClass=group)',
        attributes: ['cn', 'distinguishedName'],
        paged: { pageSize: 1000, pagePause: false },
      };

      return await new Promise((resolve, reject) => {
        const groups: any[] = [];

        client.search(this.BASE_DN, options, (err, res) => {
          if (err) return reject(err);

          res.on('searchEntry', (entry: any) => {
            const attrs = entry.pojo.attributes || [];
            const attrMap: Record<string, string | string[]> = {};

            for (const attr of attrs) {
              if (!attr.values || attr.values.length === 0) continue;
              attrMap[attr.type] =
                attr.values.length === 1 ? attr.values[0] : attr.values;
            }

            groups.push({
              name: (attrMap['cn'] as string) ?? null,
              dn:
                (attrMap['distinguishedName'] as string) ??
                entry.pojo.objectName ??
                null,
            });
          });

          res.on('error', reject);
          res.on('end', () => resolve(groups));
        });
      });
    } catch (error) {
      console.error('[getAllGroups] erro:', error);
      throw new InternalServerErrorException(
        'Erro ao buscar grupos no Active Directory',
      );
    } finally {
      this.safeUnbind(client);
    }
  }

  async updateUserAd(body: any): Promise<void> {
    const client = this.createClient();

    try {
      await this.bind(client);

      const sam = body.sAMAccountName || body.samaccountname || body.login;
      const targetGroupsRaw: string[] = body.targetGroupsDns || [];

      if (!sam) throw new Error('sAMAccountName não informado');

      const userDn = await this.findUserDnBySam(client, sam);

      // pega memberOf + primaryGroupID
      const { memberOf, primaryGroupId } =
        await this.getUserMembershipStateBySam(client, sam);

      // resolve DN do primary group (ex: Usuários do domínio)
      const primaryGroupDn = primaryGroupId
        ? await this.findPrimaryGroupDnByToken(client, primaryGroupId).catch(
            () => null,
          )
        : null;

      // currentAll: memberOf + primary group (só para calcular toAdd)
      const currentAll = primaryGroupDn
        ? [...memberOf, primaryGroupDn]
        : memberOf;

      // dedup e comparação robusta
      const currentAllKeys = new Set(currentAll.map((g) => this.dnKey(g)));

      const targetGroups = Array.from(
        new Map(targetGroupsRaw.map((g) => [this.dnKey(g), g])).values(),
      );
      const targetKeys = new Set(targetGroups.map((g) => this.dnKey(g)));

      // adicionar: o que está no target mas não está no currentAll
      let toAdd = targetGroups.filter(
        (g) => !currentAllKeys.has(this.dnKey(g)),
      );

      // remover: só remove do memberOf (não mexe com primary group)
      let toRemove = memberOf.filter((g) => !targetKeys.has(this.dnKey(g)));

      // proteção extra: nunca tenta mexer explicitamente no primary group
      if (primaryGroupDn) {
        const pgKey = this.dnKey(primaryGroupDn);
        toAdd = toAdd.filter((g) => this.dnKey(g) !== pgKey);
        toRemove = toRemove.filter((g) => this.dnKey(g) !== pgKey);
      }

      for (const groupDn of toAdd) {
        await this.modifyGroupMembership(client, groupDn, userDn, 'add');
      }

      for (const groupDn of toRemove) {
        await this.modifyGroupMembership(client, groupDn, userDn, 'delete');
      }
    } catch (error) {
      console.error('[updateUserAd] erro:', error);
      throw new InternalServerErrorException('Erro ao atualizar usuário no AD');
    } finally {
      this.safeUnbind(client);
    }
  }

  async resetPasswordAndForceChange(body: any): Promise<void> {
    const client = this.createClient();

    try {
      await this.bind(client);

      const sam = body.sAMAccountName || body.samaccountname || body.login;
      if (!sam) throw new Error('sAMAccountName não informado');

      const newPassword = process.env.AD_BIND_PASSWORD; // <-- recomendo vir no body
      if (!newPassword) throw new Error('newPassword não informado');

      const userDn = await this.findUserDnBySam(client, sam);

      // 1) reset de senha
      await this.setUnicodePwd(client, userDn, newPassword);

      // 2) força trocar no próximo logon
      await this.forcePwdChangeNextLogon(client, userDn);
    } catch (error: any) {
      console.error(
        '[resetPasswordAndForceChange]',
        error?.code,
        error?.name,
        error?.message,
        error?.lde_dn,
      );
      throw new InternalServerErrorException('Erro ao resetar senha no AD');
    } finally {
      this.safeUnbind(client);
    }
  }

  // private async getDefaultNamingContext(client: ldap.Client): Promise<string> {
  //   const opts: ldap.SearchOptions = {
  //     scope: 'base',
  //     filter: '(objectClass=*)',
  //     attributes: ['defaultNamingContext'],
  //   };

  //   return new Promise((resolve, reject) => {
  //     client.search('', opts, (err, res) => {
  //       if (err) return reject(err);

  //       let baseDn: string | null = null;

  //       res.on('searchEntry', (entry: any) => {
  //         /**
  //          * Forma mais confiável no ldapjs:
  //          * entry.object já vem "flattened"
  //          */
  //         if (entry.object?.defaultNamingContext) {
  //           baseDn = entry.object.defaultNamingContext;
  //         }

  //         /**
  //          * Fallback defensivo (caso alguma versão diferente)
  //          */
  //         if (!baseDn && Array.isArray(entry.attributes)) {
  //           const attr = entry.attributes.find(
  //             (a: any) => a.type === 'defaultNamingContext',
  //           );

  //           if (attr?.values?.length) baseDn = attr.values[0];
  //         }
  //       });

  //       res.on('error', reject);

  //       res.on('end', () => {
  //         if (!baseDn) {
  //           return reject(
  //             new Error('defaultNamingContext não encontrado no RootDSE'),
  //           );
  //         }
  //         resolve(baseDn);
  //       });
  //     });
  //   });
  // }

  // private async assertDnExists(client: ldap.Client, dn: string): Promise<void> {
  //   const safeDn = this.normalizeDn(dn);

  //   const opts: ldap.SearchOptions = {
  //     scope: 'base',
  //     filter: '(objectClass=*)',
  //     attributes: ['distinguishedName'],
  //     sizeLimit: 1,
  //   };

  //   await new Promise<void>((resolve, reject) => {
  //     let ok = false;

  //     client.search(safeDn, opts, (err, res) => {
  //       if (err) return reject(err);

  //       res.on('searchEntry', () => (ok = true));
  //       res.on('error', reject);
  //       res.on('end', () =>
  //         ok ? resolve() : reject(new Error(`DN não existe: ${safeDn}`)),
  //       );
  //     });
  //   });
  // }

  // private async findUserDnAndGuidBySam(
  //   client: ldap.Client,
  //   sam: string,
  // ): Promise<{ dn: string; guid: Buffer }> {
  //   const samEscaped = this.escapeFilter(sam);

  //   const options: ldap.SearchOptions = {
  //     scope: 'sub',
  //     filter: `(&(objectClass=user)(sAMAccountName=${samEscaped}))`,
  //     attributes: ['distinguishedName', 'objectGUID'],
  //     sizeLimit: 1,
  //   };

  //   return new Promise((resolve, reject) => {
  //     let dn: string | null = null;
  //     let guid: Buffer | null = null;

  //     client.search(this.BASE_DN, options, (err, res) => {
  //       if (err) return reject(err);

  //       res.on('searchEntry', (entry: any) => {
  //         dn = entry.object?.distinguishedName ?? dn;

  //         // dependendo da versão, objectGUID vem como Buffer ou string binária
  //         const raw = entry.object?.objectGUID;
  //         if (Buffer.isBuffer(raw)) guid = raw;
  //         else if (typeof raw === 'string') guid = Buffer.from(raw, 'binary');

  //         // fallback: attributes
  //         if (!guid && Array.isArray(entry.attributes)) {
  //           const a = entry.attributes.find(
  //             (x: any) => x.type === 'objectGUID',
  //           );
  //           const v = a?.values?.[0];
  //           if (v) guid = Buffer.isBuffer(v) ? v : Buffer.from(v, 'binary');
  //         }
  //       });

  //       res.on('error', reject);
  //       res.on('end', () => {
  //         if (!dn || !guid)
  //           return reject(new Error('Não consegui obter DN/GUID do usuário'));
  //         resolve({ dn, guid });
  //       });
  //     });
  //   });
  // }

  // private async testWriteDescription(
  //   client: ldap.Client,
  //   dn: string,
  // ): Promise<void> {
  //   const AttributeCtor = (ldap as any).Attribute;
  //   const ChangeCtor = (ldap as any).Change;

  //   const attr = new AttributeCtor({ type: 'description' });
  //   attr.addValue(`pwd-reset-test ${new Date().toISOString()}`);

  //   const change = new ChangeCtor({
  //     operation: 'replace',
  //     modification: attr,
  //   });

  //   await new Promise<void>((resolve, reject) => {
  //     client.modify(dn, [change], (err) => (err ? reject(err) : resolve()));
  //   });
  // }

  private normalizeDn(dn: string): string {
    if (!dn || typeof dn !== 'string') return dn as any;

    // remove lixo invisível (linha, espaço no fim) que também causa "No Such Object"
    const trimmed = dn.trim();

    // Converte qualquer char não-ASCII para \HH\HH... (bytes UTF-8)
    return trimmed.replace(/[^\x00-\x7F]/g, (ch) => {
      const hex = Buffer.from(ch, 'utf8').toString('hex').toUpperCase(); // ex: 'C3A1'
      const pairs = hex.match(/../g) || [];
      return pairs.map((p) => `\\${p}`).join(''); // vira '\C3\A1'
    });
  }

  private async setUnicodePwd(
    client: ldap.Client,
    dn: string,
    password: string,
  ): Promise<void> {
    const AttributeCtor = (ldap as any).Attribute;
    const ChangeCtor = (ldap as any).Change;

    const passwordBuffer = Buffer.from(`"${password}"`, 'utf16le');

    const attr = new AttributeCtor({ type: 'unicodePwd' });
    attr.addValue(passwordBuffer);

    const change = new ChangeCtor({
      operation: 'replace',
      modification: attr,
    });

    await new Promise<void>((resolve, reject) => {
      client.modify(dn, [change], (err) => (err ? reject(err) : resolve()));
    });
  }

  private async forcePwdChangeNextLogon(
    client: ldap.Client,
    dn: string,
  ): Promise<void> {
    const AttributeCtor = (ldap as any).Attribute;
    const ChangeCtor = (ldap as any).Change;

    const attr = new AttributeCtor({ type: 'pwdLastSet' });
    attr.addValue('0');

    const change = new ChangeCtor({
      operation: 'replace',
      modification: attr,
    });

    await new Promise<void>((resolve, reject) => {
      client.modify(dn, [change], (err) => (err ? reject(err) : resolve()));
    });
  }

  private dnKey(dn: string): string {
    return this.normalizeDn(dn).trim().toLowerCase();
  }

  private async getUserMembershipStateBySam(
    client: ldap.Client,
    sam: string,
  ): Promise<{ memberOf: string[]; primaryGroupId?: string }> {
    const samEscaped = this.escapeFilter(sam);

    const options: ldap.SearchOptions = {
      scope: 'sub',
      filter: `(&(objectClass=user)(sAMAccountName=${samEscaped}))`,
      attributes: ['memberOf', 'primaryGroupID'],
      sizeLimit: 1,
    };

    return new Promise((resolve, reject) => {
      let memberOf: string[] = [];
      let primaryGroupId: string | undefined;

      client.search(this.BASE_DN, options, (err, res) => {
        if (err) return reject(err);

        res.on('searchEntry', (entry: any) => {
          // memberOf (forma "flattened")
          const mo = entry.object?.memberOf;
          if (mo) memberOf = Array.isArray(mo) ? mo : [mo];

          // fallback (pojo)
          if ((!mo || memberOf.length === 0) && entry.pojo?.attributes) {
            const attrs = entry.pojo.attributes || [];
            const moAttr = attrs.find((a: any) => a.type === 'memberOf');
            if (moAttr?.values?.length) memberOf = [...moAttr.values];
          }

          // primaryGroupID
          const pg = entry.object?.primaryGroupID;
          if (pg) primaryGroupId = String(pg);

          if (!primaryGroupId && entry.pojo?.attributes) {
            const attrs = entry.pojo.attributes || [];
            const pgAttr = attrs.find((a: any) => a.type === 'primaryGroupID');
            if (pgAttr?.values?.[0]) primaryGroupId = String(pgAttr.values[0]);
          }
        });

        res.on('error', reject);
        res.on('end', () => resolve({ memberOf, primaryGroupId }));
      });
    });
  }

  private async findPrimaryGroupDnByToken(
    client: ldap.Client,
    token: string,
  ): Promise<string | null> {
    const options: ldap.SearchOptions = {
      scope: 'sub',
      filter: `(&(objectClass=group)(primaryGroupToken=${this.escapeFilter(token)}))`,
      attributes: ['cn'],
      sizeLimit: 1,
    };

    return new Promise((resolve, reject) => {
      let foundDn: string | null = null;

      client.search(this.BASE_DN, options, (err, res) => {
        if (err) return reject(err);

        res.on('searchEntry', (entry: any) => {
          foundDn = entry?.dn?.toString?.() ?? entry?.pojo?.objectName ?? null;
        });

        res.on('error', reject);
        res.on('end', () => resolve(foundDn));
      });
    });
  }
}

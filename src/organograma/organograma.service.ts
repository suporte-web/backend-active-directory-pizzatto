import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as ldap from 'ldapjs';

export interface ColaboradorAD {
  dn: string;
  username?: string;
  nome: string;
  email?: string;
  cargo?: string;
  departamento?: string;
  managerDn?: string | null;
  telefone?: string;
}

export interface OrganogramaNode {
  dn: string;
  username?: string;
  nome: string;
  email?: string;
  cargo?: string;
  departamento?: string;
  managerDn?: string | null;
  lider?: string | null;
  subordinados: OrganogramaNode[];
  telefone?: string;
}

@Injectable()
export class OrganogramaService {
  private readonly url = process.env.AD_URL!;
  private readonly bindIdentity = (process.env.AD_BIND_IDENTITY || '').trim();
  private readonly bindPassword = (process.env.AD_BIND_PASSWORD || '')
    .replace(/\r/g, '')
    .replace(/\n/g, '')
    .trim();

  private readonly BASE_DN = 'DC=pizzatto,DC=local';

  private createClient(): ldap.Client {
    const options: ldap.ClientOptions = {
      url: this.url,
      timeout: 30000,
      connectTimeout: 30000,
      reconnect: false,
    };

    if (this.url.startsWith('ldaps://')) {
      options.tlsOptions = {
        rejectUnauthorized: false,
      };
    }

    const client = ldap.createClient(options);

    client.on('error', (err) => {
      if ((err as any)?.code === 'ECONNRESET') return;
      console.error('[LDAP][Organograma] client error:', err);
    });

    return client;
  }

  private async bind(client: ldap.Client): Promise<void> {
    return new Promise((resolve, reject) => {
      client.bind(this.bindIdentity, this.bindPassword, (err) => {
        if (err) {
          console.error(
            '[LDAP][Organograma][bind] err raw:',
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

  private normalizeDn(dn?: string | null): string | null {
    if (!dn || typeof dn !== 'string') return null;
    return dn.trim().toLowerCase();
  }

  private normalizeText(value?: string | null): string {
    return (value || '').trim().toLowerCase();
  }

  private getSingleValue(value: unknown): string | undefined {
    if (typeof value === 'string') return value;

    if (Array.isArray(value) && value.length > 0) {
      const first = value[0];
      return typeof first === 'string' ? first : undefined;
    }

    return undefined;
  }

  private mapEntryToColaborador(entry: any): ColaboradorAD | null {
    const attrs = entry.pojo?.attributes || [];
    const attrMap: Record<string, string | string[]> = {};

    for (const attr of attrs) {
      if (!attr.values || attr.values.length === 0) continue;
      attrMap[attr.type] =
        attr.values.length === 1 ? attr.values[0] : attr.values;
    }

    const dn =
      (attrMap['distinguishedName'] as string) ??
      entry?.dn?.toString?.() ??
      entry?.pojo?.objectName ??
      null;

    if (!dn) return null;

    const nome =
      this.getSingleValue(attrMap['displayName']) ||
      this.getSingleValue(attrMap['cn']) ||
      this.getSingleValue(attrMap['name']);

    if (!nome) return null;

    return {
      dn,
      username:
        this.getSingleValue(attrMap['sAMAccountName']) ||
        this.getSingleValue(attrMap['userPrincipalName']),
      nome,
      email: this.getSingleValue(attrMap['mail']),
      cargo: this.getSingleValue(attrMap['title']),
      departamento: this.getSingleValue(attrMap['department']),
      managerDn: this.getSingleValue(attrMap['manager']) || null,
      telefone:
        this.getSingleValue(attrMap['ipPhone']) ||
        this.getSingleValue(attrMap['telephoneNumber']) ||
        this.getSingleValue(attrMap['mobile']),
    };
  }

  private async buscarColaboradoresNoAD(): Promise<ColaboradorAD[]> {
    const client = this.createClient();

    try {
      await this.bind(client);

      const options: ldap.SearchOptions = {
        scope: 'sub',
        filter:
          '(&(objectCategory=person)(objectClass=user)(!(objectClass=computer))(!(userAccountControl:1.2.840.113556.1.4.803:=2)))',
        attributes: [
          'cn',
          'name',
          'displayName',
          'mail',
          'title',
          'department',
          'manager',
          'distinguishedName',
          'sAMAccountName',
          'userPrincipalName',
          'telephoneNumber',
          'mobile',
          'ipPhone',
        ],
        paged: {
          pageSize: 1000,
          pagePause: false,
        },
      };

      return await new Promise<ColaboradorAD[]>((resolve, reject) => {
        const colaboradores: ColaboradorAD[] = [];

        client.search(this.BASE_DN, options, (err, res) => {
          if (err) return reject(err);

          res.on('searchEntry', (entry: any) => {
            const colaborador = this.mapEntryToColaborador(entry);
            if (colaborador) {
              colaboradores.push(colaborador);
            }
          });

          res.on('error', reject);
          res.on('end', () => resolve(colaboradores));
        });
      });
    } catch (error) {
      console.error('[Organograma][buscarColaboradoresNoAD] erro:', error);
      throw new InternalServerErrorException(
        'Erro ao buscar colaboradores no Active Directory',
      );
    } finally {
      this.safeUnbind(client);
    }
  }

  private montarArvore(colaboradores: ColaboradorAD[]): OrganogramaNode[] {
    const nodes = new Map<string, OrganogramaNode>();
    const roots: OrganogramaNode[] = [];

    for (const colab of colaboradores) {
      const key = this.normalizeDn(colab.dn);
      if (!key) continue;

      nodes.set(key, {
        dn: colab.dn,
        username: colab.username,
        nome: colab.nome,
        email: colab.email,
        cargo: colab.cargo,
        departamento: colab.departamento,
        managerDn: colab.managerDn,
        telefone: colab.telefone,
        lider: null,
        subordinados: [],
      });
    }

    for (const colab of colaboradores) {
      const currentKey = this.normalizeDn(colab.dn);
      if (!currentKey) continue;

      const currentNode = nodes.get(currentKey);
      if (!currentNode) continue;

      const managerKey = this.normalizeDn(colab.managerDn);

      if (managerKey && nodes.has(managerKey)) {
        const managerNode = nodes.get(managerKey)!;
        currentNode.lider = managerNode.nome;
        managerNode.subordinados.push(currentNode);
      } else {
        roots.push(currentNode);
      }
    }

    const sortRecursively = (node: OrganogramaNode) => {
      node.subordinados.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      for (const child of node.subordinados) {
        sortRecursively(child);
      }
    };

    const filteredRoots = roots
      .filter((node) => node.subordinados.length > 0 || !node.managerDn)
      .filter((node) => !(node.subordinados.length === 0 && !node.managerDn));

    filteredRoots.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    filteredRoots.forEach(sortRecursively);

    return filteredRoots;
  }

  private buscarNodoPorUsername(
    roots: OrganogramaNode[],
    username: string,
  ): OrganogramaNode | null {
    const target = this.normalizeText(username);

    const dfs = (node: OrganogramaNode): OrganogramaNode | null => {
      const user = this.normalizeText(node.username);
      if (user === target) return node;

      for (const child of node.subordinados) {
        const found = dfs(child);
        if (found) return found;
      }

      return null;
    };

    for (const root of roots) {
      const found = dfs(root);
      if (found) return found;
    }

    return null;
  }

  private buscarNodoPorTermo(
    roots: OrganogramaNode[],
    termo: string,
  ): OrganogramaNode | null {
    const target = this.normalizeText(termo);

    const dfs = (node: OrganogramaNode): OrganogramaNode | null => {
      const campos = [
        node.nome,
        node.username,
        node.email,
        node.cargo,
        node.departamento,
      ]
        .filter(Boolean)
        .map((v) => this.normalizeText(v));

      if (campos.some((campo) => campo.includes(target))) {
        return node;
      }

      for (const child of node.subordinados) {
        const found = dfs(child);
        if (found) return found;
      }

      return null;
    };

    for (const root of roots) {
      const found = dfs(root);
      if (found) return found;
    }

    return null;
  }

  private filtrarPorDepartamento(
    nodes: OrganogramaNode[],
    departamento: string,
  ): OrganogramaNode[] {
    const alvo = this.normalizeText(departamento);

    const filtrarNodo = (node: OrganogramaNode): OrganogramaNode | null => {
      const departamentoNode = this.normalizeText(node.departamento);
      const subordinadosFiltrados = node.subordinados
        .map(filtrarNodo)
        .filter((item): item is OrganogramaNode => item !== null);

      const pertenceAoDepartamento = departamentoNode.includes(alvo);

      if (pertenceAoDepartamento || subordinadosFiltrados.length > 0) {
        return {
          ...node,
          subordinados: subordinadosFiltrados,
        };
      }

      return null;
    };

    return nodes
      .map(filtrarNodo)
      .filter((item): item is OrganogramaNode => item !== null);
  }

  async obterOrganogramaCompleto(): Promise<OrganogramaNode[]> {
    const colaboradores = await this.buscarColaboradoresNoAD();
    return this.montarArvore(colaboradores);
  }

  async obterOrganogramaPorUsuario(
    username: string,
  ): Promise<OrganogramaNode | null> {
    const colaboradores = await this.buscarColaboradoresNoAD();
    const roots = this.montarArvore(colaboradores);
    return this.buscarNodoPorUsername(roots, username);
  }

  async obterOrganogramaPorColaborador(
    termo: string,
  ): Promise<OrganogramaNode | null> {
    const colaboradores = await this.buscarColaboradoresNoAD();
    const roots = this.montarArvore(colaboradores);
    return this.buscarNodoPorTermo(roots, termo);
  }

  async obterOrganogramaPorDepartamento(
    departamento: string,
  ): Promise<OrganogramaNode[]> {
    const colaboradores = await this.buscarColaboradoresNoAD();
    const roots = this.montarArvore(colaboradores);
    return this.filtrarPorDepartamento(roots, departamento);
  }

  async listarColaboradoresSemGestor(): Promise<OrganogramaNode[]> {
    const colaboradores = await this.buscarColaboradoresNoAD();
    const roots = this.montarArvore(colaboradores);
    return roots;
  }
}

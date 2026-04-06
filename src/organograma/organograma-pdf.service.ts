import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { OrganogramaService } from './organograma.service';

type TipoGeracaoPdf = 'completo' | 'departamento' | 'colaborador';

interface GerarPdfParams {
  tipo: TipoGeracaoPdf;
  valor?: string;
}

interface OrganogramaNode {
  nome?: string;
  username?: string;
  setor?: string;
  email?: string;
  lider?: string;
  subordinados?: OrganogramaNode[];
}

type ChildrenLayoutMode =
  | 'horizontal'
  | 'vertical'
  | 'mixed'
  | 'stacked-with-deep-branch';

@Injectable()
export class OrganogramaPdfService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrganogramaPdfService.name);
  private browser: puppeteer.Browser | null = null;

  private static readonly MAX_TREE_DEPTH = 30;

  constructor(private readonly organogramaService: OrganogramaService) {}

  async onModuleInit(): Promise<void> {
    try {
      this.browser = await this.launchBrowser();
      this.logger.log('Browser do Puppeteer inicializado com sucesso.');
    } catch (error) {
      this.logger.error('Falha ao inicializar browser do Puppeteer.', error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.closeBrowser();
  }

  async gerarPdf({ tipo, valor }: GerarPdfParams): Promise<Buffer> {
    let page: puppeteer.Page | null = null;

    try {
      const valorNormalizado = this.normalizarValor(valor);

      const dados = await this.obterDadosOrganograma({
        tipo,
        valor: valorNormalizado,
      });

      if (!dados.length) {
        throw new BadRequestException(
          'Nenhum dado encontrado para gerar o PDF do organograma.',
        );
      }

      const html = this.montarHtmlOrganograma(dados, tipo, valorNormalizado);

      const browser = await this.getBrowser();
      page = await browser.newPage();

      await page.setViewport({
        width: 6000,
        height: 4000,
        deviceScaleFactor: 1,
      });

      await page.setContent(html, {
        waitUntil: ['domcontentloaded', 'networkidle0'],
        timeout: 60000,
      });

      await page.emulateMediaType('screen');

      await page.evaluate(async () => {
        const docWithFonts = document as Document & {
          fonts?: FontFaceSet;
        };

        if (docWithFonts.fonts) {
          await docWithFonts.fonts.ready;
        }
      });

      const dimensions = await page.evaluate(() => {
        const el = document.getElementById('organograma-print-area');
        if (!el) return null;

        const rect = el.getBoundingClientRect();

        return {
          width: Math.ceil(
            Math.max(el.scrollWidth, el.clientWidth, rect.width),
          ),
          height: Math.ceil(
            Math.max(el.scrollHeight, el.clientHeight, rect.height),
          ),
        };
      });

      if (!dimensions?.width || !dimensions?.height) {
        throw new BadRequestException(
          'Não foi possível calcular o tamanho do organograma.',
        );
      }

      const pdf = await this.gerarPdfDaPagina(page, dimensions);

      if (!pdf?.length) {
        throw new BadRequestException('O PDF gerado está vazio.');
      }

      return Buffer.from(pdf);
    } catch (error) {
      this.logger.error('Erro detalhado ao gerar PDF do organograma:', error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException(
        `Erro ao gerar PDF do organograma: ${
          error instanceof Error ? error.message : 'erro desconhecido'
        }`,
      );
    } finally {
      if (page) {
        try {
          if (!page.isClosed()) {
            await page.close();
          }
        } catch (closeError) {
          this.logger.warn(
            `Falha ao fechar página do Puppeteer: ${
              closeError instanceof Error
                ? closeError.message
                : 'erro desconhecido'
            }`,
          );
        }
      }
    }
  }

  private async launchBrowser(): Promise<puppeteer.Browser> {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    });

    browser.on('disconnected', () => {
      this.logger.warn('Browser do Puppeteer foi desconectado.');
      this.browser = null;
    });

    return browser;
  }

  private async closeBrowser(): Promise<void> {
    if (!this.browser) return;

    try {
      await this.browser.close();
    } catch (error) {
      this.logger.warn(
        `Erro ao fechar browser do Puppeteer: ${
          error instanceof Error ? error.message : 'erro desconhecido'
        }`,
      );
    } finally {
      this.browser = null;
    }
  }

  private async getBrowser(): Promise<puppeteer.Browser> {
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }

    await this.closeBrowser();
    this.browser = await this.launchBrowser();
    return this.browser;
  }

  private async gerarPdfDaPagina(
    page: puppeteer.Page,
    dimensions: { width: number; height: number },
  ): Promise<Uint8Array> {
    const padding = 300;

    return page.pdf({
      printBackground: true,
      width: `${dimensions.width + padding}px`,
      height: `${dimensions.height + padding}px`,
      preferCSSPageSize: false,
      pageRanges: '1',
      scale: 1,
      margin: {
        top: '8px',
        right: '8px',
        bottom: '8px',
        left: '8px',
      },
    });
  }

  private async obterDadosOrganograma({
    tipo,
    valor,
  }: GerarPdfParams): Promise<OrganogramaNode[]> {
    if (tipo === 'completo') {
      const resultado =
        await this.organogramaService.obterOrganogramaCompleto();

      return Array.isArray(resultado) ? (resultado as OrganogramaNode[]) : [];
    }

    if (tipo === 'departamento') {
      if (!valor) {
        throw new BadRequestException(
          'O valor do departamento é obrigatório para gerar o PDF.',
        );
      }

      const resultado =
        await this.organogramaService.obterOrganogramaPorDepartamento(valor);

      return Array.isArray(resultado) ? (resultado as OrganogramaNode[]) : [];
    }

    if (tipo === 'colaborador') {
      if (!valor) {
        throw new BadRequestException(
          'O valor do colaborador é obrigatório para gerar o PDF.',
        );
      }

      const resultado =
        await this.organogramaService.obterOrganogramaPorColaborador(valor);

      return resultado ? [resultado as OrganogramaNode] : [];
    }

    throw new BadRequestException('Tipo de geração de PDF inválido.');
  }

  private montarHtmlOrganograma(
    dados: OrganogramaNode[],
    tipo: TipoGeracaoPdf,
    valor?: string,
  ): string {
    const titulo =
      tipo === 'departamento' && valor
        ? `Organograma - Departamento: ${this.escapeHtml(valor)}`
        : tipo === 'colaborador' && valor
          ? `Organograma - Colaborador: ${this.escapeHtml(valor)}`
          : 'Organograma Completo';

    const isCompleto = tipo === 'completo';
    const usarCorCompleto = tipo === 'completo' || tipo === 'colaborador';

    const arvoresHtml = dados
      .map((node) => this.renderNode(node, tipo, true, 0, new Set()))
      .join('');

    const connectorWidth = isCompleto ? '1px' : '2px';
    const connectorHeight = isCompleto ? '6px' : '8px';
    const connectorColor = isCompleto ? '#9ca3af' : '#cbd5e1';
    const childrenGap = isCompleto ? '8px' : '10px';
    const childrenMarginTop = isCompleto ? '8px' : '18px';
    const childrenPaddingTop = isCompleto ? '8px' : '18px';
    const mixedGap = isCompleto ? '8px' : '12px';
    const groupPaddingTop = isCompleto ? '8px' : '14px';
    const leafColumns = 2;

    const nodeCardStyle = usarCorCompleto
      ? `
        .node-card {
          min-width: ${isCompleto ? '88px' : '180px'};
          max-width: ${isCompleto ? '120px' : '220px'};
          background: #ffffff;
          border: 1px solid #f97316;
          border-radius: ${isCompleto ? '4px' : '10px'};
          padding: ${isCompleto ? '5px 6px' : '8px 10px'};
          text-align: center;
          box-shadow: ${isCompleto ? 'none' : '0 2px 6px rgba(0, 0, 0, 0.05)'};
          page-break-inside: avoid;
          break-inside: avoid;
          flex: 0 0 auto;
        }

        .node-name {
          font-size: ${isCompleto ? '8px' : '12px'};
          font-weight: 700;
          color: #111827;
          margin: ${isCompleto ? '0' : '0 0 4px 0'};
          word-break: break-word;
          overflow-wrap: anywhere;
          line-height: ${isCompleto ? '1.1' : '1.2'};
        }

        .node-meta {
          font-size: ${isCompleto ? '6px' : '10px'};
          color: #374151;
          margin-top: ${isCompleto ? '1px' : '2px'};
          word-break: break-word;
          overflow-wrap: anywhere;
          line-height: ${isCompleto ? '1.1' : '1.25'};
        }
      `
      : `
        .node-card {
          width: 180px;
          background: #f9fafb;
          border: 1px solid #d1d5db;
          border-radius: 10px;
          padding: 8px 10px;
          text-align: center;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
          page-break-inside: avoid;
          break-inside: avoid;
          flex: 0 0 auto;
        }

        .node-name {
          font-size: 12px;
          font-weight: 700;
          color: #111827;
          margin-bottom: 4px;
          word-break: break-word;
          overflow-wrap: anywhere;
          line-height: 1.2;
        }

        .node-meta {
          font-size: 10px;
          color: #4b5563;
          margin-top: 2px;
          word-break: break-word;
          overflow-wrap: anywhere;
          line-height: 1.25;
        }
      `;

    const rootClass = dados.length > 1 ? 'multiple-roots' : '';

    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>${titulo}</title>
          <style>
            * {
              box-sizing: border-box;
            }

            html {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            html,
            body {
              margin: 0;
              padding: 0;
              background: #e5e7eb;
              color: #1f2937;
              font-family: Arial, Helvetica, sans-serif;
            }

            body {
              padding: 8px;
            }

            .page {
              display: block;
              background: #e5e7eb;
              width: max-content;
              min-width: max-content;
            }

            .header {
              margin-bottom: 8px;
              border-bottom: 1px solid #9ca3af;
              padding-bottom: 6px;
              width: 100%;
            }

            .title {
              font-size: 11px;
              font-weight: 700;
              margin: 0 0 2px 0;
            }

            .subtitle {
              font-size: 7px;
              color: #6b7280;
              margin: 0;
            }

            #pdf-page-content {
              display: block;
              width: max-content;
              min-width: max-content;
            }

            #organograma-print-area {
              display: flex;
              flex-direction: column;
              align-items: flex-start;
              gap: 6px;
              padding: 4px;
              background: #e5e7eb;
              width: max-content;
              min-width: max-content;
            }

            #organograma-print-area.multiple-roots {
              display: flex;
              flex-direction: row;
              align-items: flex-start;
              justify-content: flex-start;
              flex-wrap: nowrap;
              gap: 20px;
              width: max-content;
              min-width: 100%;
            }

            .tree-root {
              display: flex;
              flex-direction: column;
              align-items: center;
              position: relative;
              page-break-inside: avoid;
              break-inside: avoid;
              flex: 0 0 auto;
            }

            .node-wrapper {
              display: flex;
              flex-direction: column;
              align-items: center;
              position: relative;
              page-break-inside: avoid;
              break-inside: avoid;
              flex: 0 0 auto;
            }

            ${nodeCardStyle}

            .children,
            .children-group {
              display: flex;
              position: relative;
            }

            .children {
              margin-top: ${childrenMarginTop};
              padding-top: ${childrenPaddingTop};
            }

            .children-split {
              display: flex;
              flex-direction: row;
              align-items: flex-start;
              justify-content: center;
              gap: ${mixedGap};
              flex-wrap: nowrap;
            }

            .children-stack-group {
              display: grid;
              grid-template-columns: 1fr;
              row-gap: ${childrenGap};
              column-gap: 0;
              justify-items: center;
            }

            .children-deep-group {
              display: flex;
              flex-direction: row;
              align-items: flex-start;
              gap: ${childrenGap};
              flex-wrap: nowrap;
            }

            .children::before,
            .children-group::before {
              content: '';
              position: absolute;
              top: 0;
              left: 50%;
              width: ${connectorWidth};
              height: ${connectorHeight};
              background: ${connectorColor};
              transform: translateX(-50%);
            }

            .children-horizontal {
              flex-direction: row;
              justify-content: center;
              align-items: flex-start;
              gap: ${childrenGap};
              flex-wrap: nowrap;
            }

            .children-vertical {
              display: grid;
              grid-template-columns: repeat(${leafColumns}, 1fr);
              justify-content: center;
              align-items: start;
              column-gap: ${childrenGap};
              row-gap: ${childrenGap};
              position: relative;
              width: max-content;
            }

            .children-mixed {
              flex-direction: column;
              align-items: center;
              gap: ${mixedGap};
            }

            .children-mixed-compact {
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: ${childrenGap};
            }

            .children-leaf-compact-group {
              display: grid;
              grid-template-columns: repeat(2, max-content);
              justify-content: center;
              align-items: start;
              column-gap: ${childrenGap};
              row-gap: ${childrenGap};
            }

            .children-group {
              padding-top: ${groupPaddingTop};
            }

            .children-leaf-group {
              justify-content: center;
              position: relative;
              padding-top: calc(${groupPaddingTop} + ${connectorHeight});
            }

            .children-horizontal::after,
            .children-split::after {
              content: '';
              position: absolute;
              top: ${connectorHeight};
              left: 0;
              width: 100%;
              height: ${connectorWidth};
              background: ${connectorColor};
            }

            .children-all-leaders-group {
              display: flex;
              flex-direction: row;
              justify-content: center;
              align-items: flex-start;
              gap: ${childrenGap};
              flex-wrap: nowrap;
              width: max-content;
            }

            .child {
              display: flex;
              flex-direction: column;
              align-items: center;
              position: relative;
              page-break-inside: avoid;
              break-inside: avoid;
            }

            .child::before {
              content: '';
              position: absolute;
              top: calc(-1 * ${connectorHeight});
              left: 50%;
              width: ${connectorWidth};
              height: ${connectorHeight};
              background: ${connectorColor};
              transform: translateX(-50%);
            }

            .child-leaf::before {
              content: '';
              position: absolute;
              top: calc(-1 * ${connectorHeight});
              left: 50%;
              width: ${connectorWidth};
              height: ${connectorHeight};
              background: ${connectorColor};
              transform: translateX(-50%);
            }

            .empty {
              padding: 32px;
              text-align: center;
              color: #6b7280;
              border: 1px dashed #d1d5db;
              border-radius: 12px;
              width: 100%;
            }

            @page {
              margin: 12px;
            }

            @media print {
              body {
                padding: 8px;
              }
            }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="header">
              <h1 class="title">${titulo}</h1>
              <p class="subtitle">
                Documento gerado automaticamente em ${this.formatarDataHora()}
              </p>
            </div>

            <div id="pdf-page-content">
              <div id="organograma-print-area" class="${rootClass}">
                ${
                  arvoresHtml
                    ? arvoresHtml
                    : '<div class="empty">Nenhum dado encontrado para exibição.</div>'
                }
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private obterSubordinados(node?: OrganogramaNode): OrganogramaNode[] {
    if (!node || !Array.isArray(node.subordinados)) {
      return [];
    }

    return node.subordinados.filter(
      (subordinado): subordinado is OrganogramaNode => Boolean(subordinado),
    );
  }

  private possuiSubordinados(node?: OrganogramaNode): boolean {
    return this.obterSubordinados(node).length > 0;
  }

  private possuiSubordinadoComSubordinados(node?: OrganogramaNode): boolean {
    const subordinados = this.obterSubordinados(node);

    return subordinados.some((subordinado) =>
      this.possuiSubordinados(subordinado),
    );
  }

  private ehLiderProfundo(node?: OrganogramaNode): boolean {
    return (
      this.possuiSubordinados(node) &&
      this.possuiSubordinadoComSubordinados(node)
    );
  }

  private definirLayoutFilhos(
    subordinados: OrganogramaNode[],
  ): ChildrenLayoutMode {
    const lideresProfundos = subordinados.filter((subordinado) =>
      this.ehLiderProfundo(subordinado),
    );

    const lideresSimples = subordinados.filter(
      (subordinado) =>
        this.possuiSubordinados(subordinado) &&
        !this.ehLiderProfundo(subordinado),
    );

    const colaboradoresSemSubordinados = subordinados.filter(
      (subordinado) => !this.possuiSubordinados(subordinado),
    );

    // Caso especial:
    // existe pelo menos um ramo mais profundo e vários outros irmãos simples.
    // Mantém o ramo profundo ao lado e empilha os demais na vertical.
    if (
      lideresProfundos.length >= 1 &&
      lideresSimples.length + colaboradoresSemSubordinados.length >= 1
    ) {
      return 'stacked-with-deep-branch';
    }

    if (!lideresProfundos.length && !lideresSimples.length) {
      return 'vertical';
    }

    if (!colaboradoresSemSubordinados.length) {
      return 'horizontal';
    }

    return 'mixed';
  }

  private renderChildren(
    subordinados: OrganogramaNode[],
    tipo: TipoGeracaoPdf,
    depth: number,
    visited: Set<OrganogramaNode>,
  ): string {
    if (!subordinados.length) {
      return '';
    }

    const layout = this.definirLayoutFilhos(subordinados);
    const todosSaoFolhas = subordinados.every(
      (subordinado) => !this.possuiSubordinados(subordinado),
    );

    if (layout === 'stacked-with-deep-branch') {
      const nodesOrdenados = subordinados;

      return `
    <div class="children children-horizontal depth-${depth}">
      ${this.renderChildrenItems(
        nodesOrdenados,
        tipo,
        depth,
        visited,
        'default',
      )}
    </div>
  `;
    }

    if (layout === 'vertical') {
      return `
      <div class="children children-vertical depth-${depth}">
        ${this.renderChildrenItems(
          subordinados,
          tipo,
          depth,
          visited,
          todosSaoFolhas ? 'leaf' : 'default',
        )}
      </div>
    `;
    }

    if (layout === 'horizontal') {
      return `
      <div class="children children-horizontal depth-${depth}">
        ${this.renderChildrenItems(subordinados, tipo, depth, visited)}
      </div>
    `;
    }

    const lideres = subordinados.filter((subordinado) =>
      this.possuiSubordinados(subordinado),
    );

    const colaboradoresSemSubordinados = subordinados.filter(
      (subordinado) => !this.possuiSubordinados(subordinado),
    );

    return `
    <div class="children children-mixed depth-${depth}">
      ${
        lideres.length
          ? `
            <div class="children-group children-horizontal">
              ${this.renderChildrenItems(lideres, tipo, depth, visited)}
            </div>
          `
          : ''
      }
      ${
        colaboradoresSemSubordinados.length
          ? `
            <div class="children-group children-vertical children-leaf-group">
              ${this.renderChildrenItems(
                colaboradoresSemSubordinados,
                tipo,
                depth,
                visited,
                'leaf',
              )}
            </div>
          `
          : ''
      }
    </div>
  `;
  }

  private renderChildrenItems(
    nodes: OrganogramaNode[],
    tipo: TipoGeracaoPdf,
    depth: number,
    visited: Set<OrganogramaNode>,
    variant: 'default' | 'leaf' = 'default',
  ): string {
    return nodes
      .map(
        (filho) => `
          <div class="child ${variant === 'leaf' ? 'child-leaf' : 'child-branch'}">
            ${this.renderNode(filho, tipo, false, depth + 1, visited)}
          </div>
        `,
      )
      .join('');
  }

  private renderNode(
    node: OrganogramaNode,
    tipo: TipoGeracaoPdf,
    isRoot = false,
    depth = 0,
    visited = new Set<OrganogramaNode>(),
  ): string {
    if (!node) {
      return '';
    }

    if (depth > OrganogramaPdfService.MAX_TREE_DEPTH) {
      return `
        <div class="${isRoot ? 'tree-root' : 'node-wrapper'}">
          <div class="node-card">
            <div class="node-name">Limite de profundidade atingido</div>
          </div>
        </div>
      `;
    }

    if (visited.has(node)) {
      return `
        <div class="${isRoot ? 'tree-root' : 'node-wrapper'}">
          <div class="node-card">
            <div class="node-name">Referência circular detectada</div>
          </div>
        </div>
      `;
    }

    visited.add(node);

    const nome = this.escapeHtml(node.nome ?? node.username ?? 'Sem nome');
    const username = this.escapeHtml(node.username ?? '');
    const setor = this.escapeHtml(node.setor ?? '');
    const email = this.escapeHtml(node.email ?? '');
    const lider = this.escapeHtml(node.lider ?? '');

    const subordinados = this.obterSubordinados(node);

    const mostrarUsername = tipo !== 'completo';
    const mostrarSetor = true;
    const mostrarEmail = tipo !== 'completo';
    const mostrarLider = tipo === 'colaborador';

    const childrenHtml = this.renderChildren(
      subordinados,
      tipo,
      depth,
      visited,
    );

    const html = `
      <div class="${isRoot ? 'tree-root' : 'node-wrapper'}">
        <div class="node-card">
          <div class="node-name">${nome}</div>
          ${mostrarUsername && username ? `<div class="node-meta">${username}</div>` : ''}
          ${mostrarSetor && setor ? `<div class="node-meta">${setor}</div>` : ''}
          ${mostrarEmail && email ? `<div class="node-meta">${email}</div>` : ''}
          ${mostrarLider && lider ? `<div class="node-meta">Líder: ${lider}</div>` : ''}
        </div>

        ${childrenHtml}
      </div>
    `;

    visited.delete(node);

    return html;
  }

  private escapeHtml(value: string): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private normalizarValor(value?: string): string | undefined {
    const valor = value?.trim();
    return valor ? valor.normalize('NFC') : undefined;
  }

  private formatarDataHora(): string {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'medium',
      timeZone: 'America/Sao_Paulo',
    }).format(new Date());
  }

  private calcularEscalaParaA3(
    contentWidth: number,
    contentHeight: number,
  ): number {
    const usableWidth = 2500;
    const usableHeight = 1500;

    const scaleX = usableWidth / contentWidth;
    const scaleY = usableHeight / contentHeight;

    return Math.max(0.1, Math.min(scaleX, scaleY, 1));
  }
}

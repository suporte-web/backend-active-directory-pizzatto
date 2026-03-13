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

@Injectable()
export class OrganogramaPdfService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrganogramaPdfService.name);
  private browser: puppeteer.Browser | null = null;

  // proteção contra recursão infinita / árvore anormal
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
        width: 1600,
        height: 1200,
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

      const pdf = await this.gerarPdfDaPagina(page, tipo, dimensions);

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
    tipo: TipoGeracaoPdf,
    dimensions: { width: number; height: number },
  ): Promise<Uint8Array> {
    if (tipo === 'colaborador') {
      const scale = this.calcularEscalaParaA3(
        dimensions.width,
        dimensions.height,
      );

      return page.pdf({
        printBackground: true,
        format: 'A3',
        landscape: true,
        preferCSSPageSize: false,
        pageRanges: '1',
        scale,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px',
        },
      });
    }

    const padding = 40;

    // limites conservadores para reduzir chance de crash / invalid size
    const maxPdfWidth = 14000;
    const maxPdfHeight = 10000;

    const pdfWidth = Math.max(
      800,
      Math.min(dimensions.width + padding, maxPdfWidth),
    );
    const pdfHeight = Math.max(
      600,
      Math.min(dimensions.height + padding, maxPdfHeight),
    );

    return page.pdf({
      printBackground: true,
      preferCSSPageSize: false,
      width: `${pdfWidth}px`,
      height: `${pdfHeight}px`,
      pageRanges: '1',
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px',
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
      .map((node) => this.renderNode(node, tipo, true, 0, new WeakSet()))
      .join('');

    const nodeCardStyle = usarCorCompleto
      ? `
        .node-card {
          min-width: ${isCompleto ? '54px' : '180px'};
          max-width: ${isCompleto ? '72px' : '220px'};
          background: #ffffff;
          border: 1px solid #f97316;
          border-radius: ${isCompleto ? '2px' : '10px'};
          padding: ${isCompleto ? '1px 2px' : '8px 10px'};
          text-align: center;
          box-shadow: ${isCompleto ? 'none' : '0 2px 6px rgba(0, 0, 0, 0.05)'};
          page-break-inside: avoid;
          break-inside: avoid;
          flex: 0 0 auto;
        }

        .node-name {
          font-size: ${isCompleto ? '5px' : '12px'};
          font-weight: 700;
          color: #111827;
          margin: ${isCompleto ? '0' : '0 0 4px 0'};
          word-break: break-word;
          overflow-wrap: anywhere;
          line-height: ${isCompleto ? '1.05' : '1.2'};
        }

        .node-meta {
          font-size: ${isCompleto ? '4px' : '10px'};
          color: #374151;
          margin-top: ${isCompleto ? '1px' : '2px'};
          word-break: break-word;
          overflow-wrap: anywhere;
          line-height: ${isCompleto ? '1.05' : '1.25'};
        }
      `
      : `
        .node-card {
          min-width: 180px;
          max-width: 220px;
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

    const childrenStyle = isCompleto
      ? `
        .children {
          margin-top: 7px;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          gap: 3px;
          flex-wrap: nowrap;
          position: relative;
          min-width: max-content;
          padding-top: 7px;
          flex: 0 0 auto;
        }

        .children::before {
          content: '';
          position: absolute;
          top: 0;
          left: 50%;
          width: 1px;
          height: 4px;
          background: #9ca3af;
          transform: translateX(-50%);
        }

        .children.has-many::after {
          content: '';
          position: absolute;
          top: 4px;
          left: 50%;
          width: calc(100% - 6px);
          height: 1px;
          background: #9ca3af;
          transform: translateX(-50%);
        }

        .child::before {
          content: '';
          position: absolute;
          top: -4px;
          left: 50%;
          width: 1px;
          height: 4px;
          background: #9ca3af;
          transform: translateX(-50%);
        }
      `
      : `
        .children {
          margin-top: 18px;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          gap: 10px;
          flex-wrap: nowrap;
          position: relative;
          min-width: max-content;
          padding-top: 18px;
          flex: 0 0 auto;
        }

        .children::before {
          content: '';
          position: absolute;
          top: 0;
          left: 50%;
          width: 2px;
          height: 8px;
          background: #cbd5e1;
          transform: translateX(-50%);
        }

        .children.has-many::after {
          content: '';
          position: absolute;
          top: 8px;
          left: 50%;
          width: calc(100% - 12px);
          height: 2px;
          background: #cbd5e1;
          transform: translateX(-50%);
        }

        .child::before {
          content: '';
          position: absolute;
          top: -8px;
          left: 50%;
          width: 2px;
          height: 8px;
          background: #cbd5e1;
          transform: translateX(-50%);
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
              display: inline-block;
              min-width: max-content;
              background: #e5e7eb;
            }

            .header {
              margin-bottom: 8px;
              border-bottom: 1px solid #9ca3af;
              padding-bottom: 6px;
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
              display: inline-block;
            }

            #organograma-print-area {
              display: inline-flex;
              flex-direction: column;
              align-items: flex-start;
              gap: 6px;
              min-width: max-content;
              padding: 4px;
              background: #e5e7eb;
            }

            #organograma-print-area.multiple-roots {
              display: flex;
              flex-direction: row;
              align-items: flex-start;
              gap: 20px;
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

            ${childrenStyle}

            .child {
              display: flex;
              flex-direction: column;
              align-items: center;
              position: relative;
              page-break-inside: avoid;
              break-inside: avoid;
              flex: 0 0 auto;
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

  private renderNode(
    node: OrganogramaNode,
    tipo: TipoGeracaoPdf,
    isRoot = false,
    depth = 0,
    visited = new WeakSet<object>(),
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

    if (visited.has(node as object)) {
      return `
        <div class="${isRoot ? 'tree-root' : 'node-wrapper'}">
          <div class="node-card">
            <div class="node-name">Referência circular detectada</div>
          </div>
        </div>
      `;
    }

    visited.add(node as object);

    const nome = this.escapeHtml(node.nome ?? node.username ?? 'Sem nome');
    const username = this.escapeHtml(node.username ?? '');
    const setor = this.escapeHtml(node.setor ?? '');
    const email = this.escapeHtml(node.email ?? '');
    const lider = this.escapeHtml(node.lider ?? '');

    const subordinados = Array.isArray(node.subordinados)
      ? node.subordinados.filter(Boolean)
      : [];

    const childrenClass =
      subordinados.length > 1 ? 'children has-many' : 'children';

    // const mostrarUsername = tipo !== 'completo';
    // const mostrarCargo = tipo !== 'completo';
    // const mostrarEmail = tipo !== 'completo';
    // const mostrarLider = tipo === 'colaborador';

    const childrenHtml =
      subordinados.length > 0
        ? `
          <div class="${childrenClass}">
            ${subordinados
              .map(
                (filho) => `
                  <div class="child">
                    ${this.renderNode(filho, tipo, false, depth + 1, visited)}
                  </div>
                `,
              )
              .join('')}
          </div>
        `
        : '';

    return `
      <div class="${isRoot ? 'tree-root' : 'node-wrapper'}">
        <div class="node-card">
          <div class="node-name">${nome}</div>
          ${username ? `<div class="node-meta">${username}</div>` : ''}
          ${setor ? `<div class="node-meta">${setor}</div>` : ''}
          ${email ? `<div class="node-meta">${email}</div>` : ''}
          ${lider ? `<div class="node-meta">Líder: ${lider}</div>` : ''}
        </div>

        ${childrenHtml}
      </div>
    `;
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
    // A3 landscape com margem aproximada
    const usableWidth = 1500;
    const usableHeight = 1000;

    const scaleX = usableWidth / contentWidth;
    const scaleY = usableHeight / contentHeight;

    return Math.max(0.1, Math.min(scaleX, scaleY, 1));
  }
}

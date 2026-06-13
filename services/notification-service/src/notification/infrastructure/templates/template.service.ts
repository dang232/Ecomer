import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';

function escapeHtml(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUrl(url: string | undefined | null): string {
  if (!url) return '#';
  const trimmed = url.trim();
  if (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('/')
  )
    return trimmed;
  return '#';
}

export interface TemplateContext {
  title: string;
  body: string;
  deepLink?: string;
  orderId?: string;
  recipientName?: string;
  [key: string]: unknown;
}

/**
 * Compiles Handlebars (.hbs) email templates from the templates/ directory.
 * Falls back to a simple inline HTML layout when a named template is not found.
 */
@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);
  private readonly templatesDir: string;
  private readonly cache = new Map<string, HandlebarsTemplateDelegate>();

  constructor() {
    // Templates live next to the compiled output in dist/templates/ at runtime,
    // but during development/test they live in src/templates/.
    const candidates = [
      path.join(__dirname, '..', '..', 'templates'),
      path.join(__dirname, '..', '..', '..', 'templates'),
      path.join(process.cwd(), 'src', 'templates'),
    ];
    this.templatesDir =
      candidates.find((d) => fs.existsSync(d)) ?? candidates[0];
  }

  /**
   * Render a named template (without the .hbs extension).
   * Returns plain-HTML fallback if the template file is not found.
   */
  render(templateName: string, context: TemplateContext): string {
    const compiled = this.getCompiled(templateName);
    if (!compiled) {
      return this.fallbackHtml(context);
    }
    try {
      return compiled(context);
    } catch (err) {
      this.logger.warn(`Template render error for "${templateName}": ${err}`);
      return this.fallbackHtml(context);
    }
  }

  private getCompiled(name: string): HandlebarsTemplateDelegate | null {
    if (this.cache.has(name)) {
      return this.cache.get(name)!;
    }

    const filePath = path.join(this.templatesDir, `${name}.hbs`);
    if (!fs.existsSync(filePath)) {
      this.logger.debug(`Template not found: ${filePath}`);
      return null;
    }

    try {
      const source = fs.readFileSync(filePath, 'utf-8');
      const compiled = Handlebars.compile(source);
      this.cache.set(name, compiled);
      return compiled;
    } catch (err) {
      this.logger.warn(`Failed to compile template "${name}": ${err}`);
      return null;
    }
  }

  private fallbackHtml(ctx: TemplateContext): string {
    const deepLink = ctx.deepLink
      ? `<p><a href="${sanitizeUrl(ctx.deepLink)}">Xem chi tiết / View details</a></p>`
      : '';
    return `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">${escapeHtml(ctx.title)}</h2>
        <p style="color: #555; line-height: 1.6;">${escapeHtml(ctx.body)}</p>
        ${deepLink}
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #999; font-size: 12px;">
          VNShop — Bạn nhận email này vì đã bật thông báo qua email.<br/>
          You received this because you have email notifications enabled.
        </p>
      </div>
    `.trim();
  }
}

import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * Pure Angular pipe that safely transforms Markdown-formatted text into sanitized HTML.
 * Supports bold, italics, inline code, code blocks, bullet/numbered lists (including Japanese nakaguro '・'),
 * headers, paragraphs, and safe external links.
 * 
 * Strict XSS defense: all raw user/model input is HTML-escaped before Markdown tokens are parsed.
 */
@Pipe({
  name: 'markdown',
  standalone: true,
  pure: true
})
export class MarkdownPipe implements PipeTransform {
  private sanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined): SafeHtml {
    if (!value || typeof value !== 'string') {
      return '';
    }

    // 1. Strict HTML Entity Encoding (Defense-in-Depth against XSS)
    const escaped = value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    // 2. Parse fenced code blocks first to protect internal formatting
    const codeBlocks: string[] = [];
    let text = escaped.replace(/```(?:[a-zA-Z0-9_-]+)?\n?([\s\S]*?)```/g, (_, code) => {
      const idx = codeBlocks.length;
      codeBlocks.push(`<pre class="copilot-code-block"><code>${code.trim()}</code></pre>`);
      return `%%CODEBLOCK_${idx}%%`;
    });

    // 3. Inline code
    const inlineCodes: string[] = [];
    text = text.replace(/`([^`\n]+)`/g, (_, code) => {
      const idx = inlineCodes.length;
      inlineCodes.push(`<code class="copilot-inline-code">${code}</code>`);
      return `%%INLINECODE_${idx}%%`;
    });

    // 4. Headings (###, ##, #)
    text = text
      .replace(/^###\s+(.+)$/gm, '<h4 class="copilot-heading">$1</h4>')
      .replace(/^##\s+(.+)$/gm, '<h3 class="copilot-heading">$1</h3>')
      .replace(/^#\s+(.+)$/gm, '<h2 class="copilot-heading">$1</h2>');

    // 5. Bold & Italic formatting
    text = text
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_]+)__/g, '<strong>$1</strong>')
      .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

    // 6. Safe external links [text](https://...)
    text = text.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="copilot-link">$1</a>'
    );

    // 7. Lists (Bullet lists supporting '・', '-', '*' and numbered lists '1.')
    const lines = text.split('\n');
    const processedLines: string[] = [];
    let inUl = false;
    let inOl = false;

    for (const line of lines) {
      const bulletMatch = line.match(/^[ \t]*(?:[・]\s*|[-*]\s+)(.+)$/);
      const numberMatch = line.match(/^[ \t]*\d+\.\s+(.+)$/);

      if (bulletMatch) {
        if (inOl) {
          processedLines.push('</ol>');
          processedLines.push('');
          inOl = false;
        }
        if (!inUl) {
          processedLines.push('');
          processedLines.push('<ul class="copilot-ul">');
          inUl = true;
        }
        processedLines.push(`<li class="copilot-li">${bulletMatch[1]}</li>`);
      } else if (numberMatch) {
        if (inUl) {
          processedLines.push('</ul>');
          processedLines.push('');
          inUl = false;
        }
        if (!inOl) {
          processedLines.push('');
          processedLines.push('<ol class="copilot-ol">');
          inOl = true;
        }
        processedLines.push(`<li class="copilot-li">${numberMatch[1]}</li>`);
      } else {
        if (inUl) {
          processedLines.push('</ul>');
          processedLines.push('');
          inUl = false;
        }
        if (inOl) {
          processedLines.push('</ol>');
          processedLines.push('');
          inOl = false;
        }
        processedLines.push(line);
      }
    }
    if (inUl) {
      processedLines.push('</ul>');
      processedLines.push('');
    }
    if (inOl) {
      processedLines.push('</ol>');
      processedLines.push('');
    }

    text = processedLines.join('\n');

    // 8. Paragraphs & Line Breaks
    // Split on double newlines for paragraphs; single newlines inside blocks become <br>
    const paragraphs = text
      .split(/\n{2,}/)
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .map(p => {
        // If block is already wrapped in a block element, don't wrap in <p>
        if (p.startsWith('<ul') || p.startsWith('<ol') || p.startsWith('<pre') || p.startsWith('<h2') || p.startsWith('<h3') || p.startsWith('<h4') || p.startsWith('%%CODEBLOCK_')) {
          return p;
        }
        return `<p class="copilot-p">${p.replace(/\n/g, '<br>')}</p>`;
      });

    let rendered = paragraphs.join('');

    // 9. Restore code blocks & inline code placeholders
    rendered = rendered.replace(/%%CODEBLOCK_(\d+)%%/g, (_, idx) => codeBlocks[Number(idx)] || '');
    rendered = rendered.replace(/%%INLINECODE_(\d+)%%/g, (_, idx) => inlineCodes[Number(idx)] || '');

    return this.sanitizer.bypassSecurityTrustHtml(rendered);
  }
}

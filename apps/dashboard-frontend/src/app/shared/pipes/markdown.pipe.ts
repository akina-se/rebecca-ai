import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';

/**
 * Pure Angular pipe that safely transforms Markdown-formatted text into sanitized HTML using `marked`.
 * Supports headings (#, ##, ###), bold, italics, tables, lists, inline code, and code blocks.
 * Also normalizes Japanese nakaguro bullets ('・') into standard markdown lists for seamless LLM output.
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

    // 1. Normalize Japanese nakaguro bullets ('・' at the start of a line -> '- ')
    // Handles forms with or without spaces, e.g. '・**フォロワー数**:' -> '- **フォロワー数**:'
    const normalized = value.replace(/^[ \t]*・\s*/gm, '- ');

    // 2. Parse Markdown using marked with GFM (GitHub Flavored Markdown) and line breaks enabled
    const parsedHtml = marked.parse(normalized, {
      gfm: true,
      breaks: true,
      async: false
    }) as string;

    // 3. XSS Defense-in-Depth: Strip dangerous tags and inline event handlers
    const sanitizedHtml = parsedHtml
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
      .replace(/\s+on[a-zA-Z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');

    return this.sanitizer.bypassSecurityTrustHtml(sanitizedHtml);
  }
}

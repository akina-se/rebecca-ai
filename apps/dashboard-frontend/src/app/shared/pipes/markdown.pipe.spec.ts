import { TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { MarkdownPipe } from './markdown.pipe';

describe('MarkdownPipe', () => {
  let pipe: MarkdownPipe;
  let sanitizer: DomSanitizer;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MarkdownPipe]
    });
    sanitizer = TestBed.inject(DomSanitizer);
    pipe = TestBed.inject(MarkdownPipe);
  });

  it('should return empty string for null, undefined, or empty input', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform('')).toBe('');
  });

  it('should escape dangerous raw HTML to prevent XSS injection', () => {
    const malicious = '<script>alert("xss")</script><img src="x" onerror="evil()" />';
    const result = pipe.transform(malicious) as { changingThisBreaksApplicationSecurity?: string };
    const html = result.changingThisBreaksApplicationSecurity || String(result);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('should parse bold and italic markdown tags', () => {
    const input = 'This is **bold text** and *italic text*.';
    const result = pipe.transform(input) as { changingThisBreaksApplicationSecurity?: string };
    const html = result.changingThisBreaksApplicationSecurity || String(result);
    expect(html).toContain('<strong>bold text</strong>');
    expect(html).toContain('<em>italic text</em>');
  });

  it('should parse Japanese nakaguro and standard bullet lists into ul/li elements', () => {
    const input = `
・**フォロワー数**: 1,093人 (+33.5%)
・**エンゲージメント率**: 7.8%
- **DAU**: 10人
`;
    const result = pipe.transform(input) as { changingThisBreaksApplicationSecurity?: string };
    const html = result.changingThisBreaksApplicationSecurity || String(result);
    expect(html).toContain('<ul class="copilot-ul">');
    expect(html).toContain('<li class="copilot-li"><strong>フォロワー数</strong>: 1,093人 (+33.5%)</li>');
    expect(html).toContain('<li class="copilot-li"><strong>エンゲージメント率</strong>: 7.8%</li>');
    expect(html).toContain('<li class="copilot-li"><strong>DAU</strong>: 10人</li>');
    expect(html).toContain('</ul>');
  });

  it('should parse numbered lists into ol/li elements', () => {
    const input = `
1. 第一ステップ
2. 第二ステップ
`;
    const result = pipe.transform(input) as { changingThisBreaksApplicationSecurity?: string };
    const html = result.changingThisBreaksApplicationSecurity || String(result);
    expect(html).toContain('<ol class="copilot-ol">');
    expect(html).toContain('<li class="copilot-li">第一ステップ</li>');
    expect(html).toContain('<li class="copilot-li">第二ステップ</li>');
    expect(html).toContain('</ol>');
  });

  it('should format code blocks and inline code safely', () => {
    const input = 'Use `npm test` to run tests.\n\n```json\n{\n  "status": "ok"\n}\n```';
    const result = pipe.transform(input) as { changingThisBreaksApplicationSecurity?: string };
    const html = result.changingThisBreaksApplicationSecurity || String(result);
    expect(html).toContain('<code class="copilot-inline-code">npm test</code>');
    expect(html).toContain('<pre class="copilot-code-block"><code>');
    expect(html).toContain('&quot;status&quot;: &quot;ok&quot;');
  });

  it('should convert safe external links into anchor tags', () => {
    const input = 'Check out [Rebecca Docs](https://example.com/docs).';
    const result = pipe.transform(input) as { changingThisBreaksApplicationSecurity?: string };
    const html = result.changingThisBreaksApplicationSecurity || String(result);
    expect(html).toContain('<a href="https://example.com/docs" target="_blank" rel="noopener noreferrer" class="copilot-link">Rebecca Docs</a>');
  });
});

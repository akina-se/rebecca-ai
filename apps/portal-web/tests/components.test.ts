import { renderHead } from '../src/components/head';
import { renderHeader } from '../src/components/header';
import { renderFooter } from '../src/components/footer';
import { activePortalConfig } from '../src/config';

describe('Portal HTML Template Components', () => {
  describe('renderHead', () => {
    it('should generate head tags with default portal title and description', () => {
      const html = renderHead(activePortalConfig);
      expect(html).toContain('<title>全肯定AIレベッカ (Rebecca AI) - Autonomous Personal AI | Gemitec Inc.</title>');
      expect(html).toContain('name="description"');
      expect(html).toContain('property="og:image"');
      expect(html).toContain('name="twitter:card"');
    });

    it('should respect page-specific title and canonical overrides', () => {
      const html = renderHead(activePortalConfig, {
        title: '利用規約',
        canonicalPath: '/tos.html',
      });
      expect(html).toContain('<title>利用規約 | 全肯定AIレベッカ</title>');
      expect(html).toContain('href="https://rebecca-ai.net/tos.html"');
    });

    it('resolves relative ogpImage into fully qualified absolute URL', () => {
      const html = renderHead(activePortalConfig, {
        ogpImage: 'assets/ogp_supporters.jpg',
      });
      expect(html).toContain('content="https://rebecca-ai.net/assets/ogp_supporters.jpg"');
      expect(html).toContain('<meta name="twitter:image" content="https://rebecca-ai.net/assets/ogp_supporters.jpg">');
    });

    it('preserves already absolute ogpImage URL', () => {
      const html = renderHead(activePortalConfig, {
        ogpImage: 'https://cdn.example.com/custom.png',
      });
      expect(html).toContain('content="https://cdn.example.com/custom.png"');
    });
  });

  describe('renderHeader', () => {
    it('should render relative in-page anchor links on home page', () => {
      const html = renderHeader(activePortalConfig, 'home');
      expect(html).toContain('href="#news"');
      expect(html).toContain('href="#about"');
      expect(html).toContain('href="#profile"');
      expect(html).toContain('class="brand-logo"');
    });

    it('should render absolute root-relative links on non-home pages', () => {
      const htmlSupporters = renderHeader(activePortalConfig, 'supporters');
      expect(htmlSupporters).toContain('href="/#news"');
      expect(htmlSupporters).toContain('class="active"');

      const htmlLegal = renderHeader(activePortalConfig, 'legal');
      expect(htmlLegal).toContain('href="/#news"');
      expect(htmlLegal).not.toContain('class="active"');

      const htmlDefault = renderHeader(activePortalConfig);
      expect(htmlDefault).toContain('href="#news"');

      const htmlFallback = renderHeader(activePortalConfig, 'unknown' as any);
      expect(htmlFallback).toContain('href="/#news"');
    });
  });

  describe('renderFooter', () => {
    it('should render governance links, copyright, and disclaimer', () => {
      const html = renderFooter(activePortalConfig);
      expect(html).toContain('href="/tos.html"');
      expect(html).toContain('href="/privacy.html"');
      expect(html).toContain('href="/legal.html"');
      expect(html).toContain('Gemitec Inc.');
      expect(html).toContain('All rights reserved.');
    });

    it('should omit optional social links when not configured', () => {
      const minimalConfig = {
        ...activePortalConfig,
        social: {
          xUrl: 'https://x.com/test',
          xHandle: '@test',
        },
      };
      const html = renderFooter(minimalConfig);
      expect(html).not.toContain('YouTube');
      expect(html).not.toContain('Pixiv');
      expect(html).not.toContain('Repository (OSS)');
    });
  });
});

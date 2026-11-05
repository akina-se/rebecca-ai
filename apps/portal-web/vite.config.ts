import { defineConfig, Plugin } from 'vite';
import { resolve } from 'path';
import { activePortalConfig, generateThemeCssVariables } from './src/config/index.ts';
import { renderHead, HeadOptions } from './src/components/head.ts';
import { renderHeader, PageContext } from './src/components/header.ts';
import { renderFooter } from './src/components/footer.ts';

const rootDir = import.meta.dirname ?? process.cwd();

/**
 * Custom Vite plugin providing template inheritance, partial injection,
 * and character brand customization for static HTML pages.
 */
function portalHtmlPlugin(): Plugin {
  return {
    name: 'portal-html-template-plugin',
    transformIndexHtml(html: string) {
      let output = html;

      // Inject Theme CSS variables into <head>
      const themeCss = `<style id="portal-theme-variables">${generateThemeCssVariables(activePortalConfig)}</style>`;
      output = output.replace('</head>', `${themeCss}\n</head>`);

      // Expand @head directive: <!-- @head (options) -->
      output = output.replace(/<!--\s*@head(?:\s+({.*?}))?\s*-->/g, (_match, jsonStr) => {
        let options: HeadOptions = {};
        if (jsonStr) {
          try {
            options = JSON.parse(jsonStr);
          } catch (e) {
            console.error('Failed to parse @head JSON options:', jsonStr, e);
          }
        }
        return renderHead(activePortalConfig, options);
      });

      // Expand @header directive: <!-- @header context="home" -->
      output = output.replace(/<!--\s*@header(?:\s+context=["'](.*?)["'])?\s*-->/g, (_match, ctx) => {
        const pageContext: PageContext = (ctx === 'supporters' || ctx === 'legal') ? ctx : 'home';
        return renderHeader(activePortalConfig, pageContext);
      });

      // Expand @footer directive: <!-- @footer -->
      output = output.replace(/<!--\s*@footer\s*-->/g, () => {
        return renderFooter(activePortalConfig);
      });

      // Token replacements
      output = output
        .replace(/{{CHARACTER_NAME}}/g, activePortalConfig.displayName)
        .replace(/{{ENGLISH_NAME}}/g, activePortalConfig.englishName)
        .replace(/{{ORG_NAME}}/g, activePortalConfig.organizationName)
        .replace(/{{CANONICAL_URL}}/g, activePortalConfig.canonicalUrl)
        .replace(/{{X_URL}}/g, activePortalConfig.social.xUrl)
        .replace(/{{X_HANDLE}}/g, activePortalConfig.social.xHandle);

      return output;
    },
  };
}

export default defineConfig({
  root: '.',
  publicDir: 'public',
  plugins: [portalHtmlPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(rootDir, 'index.html'),
        supporters: resolve(rootDir, 'supporters.html'),
        tos: resolve(rootDir, 'tos.html'),
        privacy: resolve(rootDir, 'privacy.html'),
        legal: resolve(rootDir, 'legal.html'),
        tokushoho: resolve(rootDir, 'tokushoho.html'),
        thankYou: resolve(rootDir, 'support/thank-you.html'),
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});

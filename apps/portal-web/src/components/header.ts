import { PortalBrandConfig } from '@rebecca/types';

/** Supported page contexts for header navigation routing */
export type PageContext = 'home' | 'supporters' | 'legal';

/**
 * Renders the shared navigation header with bilingual controls and character branding.
 *
 * @param config - The active portal brand configuration.
 * @param activePage - The current page context.
 * @returns Serialized HTML string for <header>.
 */
export function renderHeader(config: PortalBrandConfig, activePage: PageContext = 'home'): string {
  const isHome = activePage === 'home';
  const prefix = isHome ? '' : '/';

  return `
  <header>
    <div class="container">
      <div class="nav-inner">
        <a href="/" class="brand-area">
          <img src="/${config.assets.logoSvg}" alt="${config.organizationName}" class="brand-logo" width="928" height="288">
        </a>

        <ul class="nav-links">
          <li><a href="${prefix}#news"><span class="t-ja">お知らせ</span><span class="t-en">News</span></a></li>
          <li><a href="${prefix}#about"><span class="t-ja">私たちについて</span><span class="t-en">About</span></a></li>
          <li><a href="${prefix}#profile"><span class="t-ja">${config.displayName}</span><span class="t-en">${config.englishName}</span></a></li>
          <li><a href="${prefix}#gallery"><span class="t-ja">フォト</span><span class="t-en">Gallery</span></a></li>
          <li><a href="${prefix}#opensource"><span class="t-ja">技術公開</span><span class="t-en">Open Source</span></a></li>
          <li><a href="/supporters" class="${activePage === 'supporters' ? 'active' : ''}"><span class="t-ja">サポーター</span><span class="t-en">Supporters</span></a></li>
        </ul>

        <div class="nav-actions">
          <!-- Language Switcher -->
          <div class="lang-switcher">
            <button class="lang-btn active" id="btn-lang-ja" onclick="window.setLanguage('ja')">JA</button>
            <button class="lang-btn" id="btn-lang-en" onclick="window.setLanguage('en')">EN</button>
          </div>

          <a href="${config.social.xUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-purple">
            <span class="t-ja">Xで話しかける</span>
            <span class="t-en">Talk on X</span>
          </a>
        </div>
      </div>
    </div>
  </header>
`.trim();
}

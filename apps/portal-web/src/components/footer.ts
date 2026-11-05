import { PortalBrandConfig } from '@rebecca/types';

/**
 * Renders the shared footer including character profile navigation, media links, and governance terms.
 *
 * @param config - The active portal brand configuration.
 * @returns Serialized HTML string for <footer>.
 */
export function renderFooter(config: PortalBrandConfig): string {
  const currentYear = new Date().getFullYear();

  return `
  <footer>
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <img src="/${config.assets.logoSvg}" alt="${config.organizationName}"
            style="height: 36px; width: auto; filter: brightness(1.2);" width="928" height="288" loading="lazy" decoding="async">
          <p>
            <span class="t-ja">${config.organizationName}<br>心に寄り添うパーソナルAIをすべての人へ</span>
            <span class="t-en">${config.organizationName}<br>Empathetic personal AI for everyone</span>
          </p>
        </div>

        <div class="footer-col">
          <h4>Navigation</h4>
          <ul>
            <li><a href="/#news"><span class="t-ja">お知らせ</span><span class="t-en">News</span></a></li>
            <li><a href="/#about"><span class="t-ja">私たちについて</span><span class="t-en">About</span></a></li>
            <li><a href="/#profile"><span class="t-ja">${config.characterName}</span><span class="t-en">${config.characterEnglishName}</span></a></li>
            <li><a href="/#gallery"><span class="t-ja">フォトギャラリー</span><span class="t-en">Gallery</span></a></li>
          </ul>
        </div>

        <div class="footer-col">
          <h4>Media &amp; OSS</h4>
          <ul>
            ${config.social.youtubeUrl ? `<li><a href="${config.social.youtubeUrl}" target="_blank" rel="noopener noreferrer">YouTube</a></li>` : ''}
            ${config.social.pixivUrl ? `<li><a href="${config.social.pixivUrl}" target="_blank" rel="noopener noreferrer">Pixiv</a></li>` : ''}
            ${config.social.githubUrl ? `<li><a href="${config.social.githubUrl}" target="_blank" rel="noopener noreferrer">Repository (OSS)</a></li>` : ''}
            <li><a href="/supporters"><span class="t-ja">サポーター・スポンサー</span><span class="t-en">Supporters &amp; Sponsors</span></a></li>
          </ul>
        </div>

        <div class="footer-col">
          <h4>Governance</h4>
          <ul>
            <li><a href="/tos.html">Terms of Service</a></li>
            <li><a href="/privacy.html">Privacy Policy</a></li>
            <li><a href="/legal.html"><span class="t-ja">特定商取引法に基づく表記</span><span class="t-en">Commercial Transactions</span></a></li>
            <li><a href="/sitemap.xml">Sitemap (XML)</a></li>
            <li><a href="${config.social.xUrl}" target="_blank" rel="noopener noreferrer">Contact (X)</a></li>
          </ul>
        </div>
      </div>

      <div class="footer-bottom">
        <div>
          &copy; ${currentYear} ${config.organizationName}. Developed by AKINA. All rights reserved.
        </div>
        <div class="footer-legal-links">
          <a href="/tos.html"><span class="t-ja">利用規約</span><span class="t-en">Terms</span></a>
          <span>&bull;</span>
          <a href="/privacy.html"><span class="t-ja">プライバシーポリシー</span><span class="t-en">Privacy</span></a>
          <span>&bull;</span>
          <a href="/legal.html"><span class="t-ja">特定商取引法に基づく表記</span><span class="t-en">Legal</span></a>
          <span>&bull;</span>
          <a href="/sitemap.xml"><span class="t-ja">サイトマップ</span><span class="t-en">Sitemap</span></a>
        </div>
      </div>
      <div class="footer-disclaimer">
        <span class="t-ja">${config.organizationName} は、自律型パーソナルAI「${config.characterName}」の世界観演出のために設定された研究創作プロジェクトです（運営: AKINA）。米Google LLC 等の実在企業・団体とは提携・関係ありません。</span>
        <span class="t-en">${config.organizationName} is a research &amp; creative world-building project for the autonomous personal AI "${config.characterEnglishName}", operated by AKINA. Not affiliated with Google LLC or any corporate entity.</span>
      </div>
    </div>
  </footer>

  <!-- Mobile Floating Dock -->
  <div class="mobile-dock">
    <div class="mobile-dock-inner">
      <a href="${config.social.xUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-purple"
        style="padding: 10px 16px; font-size: 13px;">
        <span class="t-ja">Xで話しかける</span>
        <span class="t-en">Talk on X</span>
      </a>
      <a href="/supporters" class="btn btn-outline"
        style="padding: 10px 12px; font-size: 13px; color: #fff;">
        <span class="t-ja">支援</span>
        <span class="t-en">Support</span>
      </a>
    </div>
  </div>
`.trim();
}

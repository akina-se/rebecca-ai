import {
  loadSupportPlans,
  loadSupporterCredits,
  renderRecentSupporters,
  escapeHtml,
  getNameFontClass,
  formatDateYMD,
  initTiersCarousel,
} from '../src/scripts/supporters';

describe('Client Script - Supporters Roster & Plans', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="recent-supporters-list"></div>
      <div id="roster-grid"></div>
      <div id="roster-meta-badge"></div>
      <div id="roster-pagination"></div>
      <div class="tier-card tier-bronze tier-disabled">
        <div class="tier-price">¥500 <span><span class="t-ja">/ 一口</span><span class="t-en">/ slot</span></span></div>
        <a id="btn-plan-bronze" class="btn-support btn-bronze btn-disabled disabled" aria-disabled="true">Coming Soon</a>
      </div>
      <div class="tier-card tier-silver featured tier-disabled">
        <div class="tier-price">¥1,000 <span><span class="t-ja">/ 一口</span><span class="t-en">/ slot</span></span></div>
        <a id="btn-plan-silver" class="btn-support btn-silver primary btn-disabled disabled" aria-disabled="true">Coming Soon</a>
      </div>
      <div class="tier-card tier-gold tier-disabled">
        <div class="tier-price">¥3,000 <span><span class="t-ja">/ 一口</span><span class="t-en">/ slot</span></span></div>
        <a id="btn-plan-gold" class="btn-support btn-gold btn-disabled disabled" aria-disabled="true">Coming Soon</a>
      </div>
    `;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('Helper Utilities', () => {
    it('escapeHtml should sanitize HTML characters', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
    });

    it('getNameFontClass should return correct size classes across boundaries', () => {
      expect(getNameFontClass(undefined)).toBe('font-len-short');
      expect(getNameFontClass(null)).toBe('font-len-short');
      expect(getNameFontClass('12345678')).toBe('font-len-short');
      expect(getNameFontClass('123456789')).toBe('font-len-medium');
      expect(getNameFontClass('1234567890123456')).toBe('font-len-medium');
      expect(getNameFontClass('12345678901234567')).toBe('font-len-long');
      expect(getNameFontClass('123456789012345678901234')).toBe('font-len-long');
      expect(getNameFontClass('1234567890123456789012345')).toBe('font-len-vlong');
    });

    it('formatDateYMD should handle empty, invalid, and valid dates', () => {
      expect(formatDateYMD(undefined)).toBe('2026/10/25');
      expect(formatDateYMD('')).toBe('2026/10/25');
      expect(formatDateYMD('invalid-date')).toBe('2026/10/25');
      expect(formatDateYMD('2026-11-05T00:00:00Z')).toContain('2026/11/');
    });
  });

  describe('loadSupportPlans', () => {
    it('should attach payment URLs, update formatted prices, and enable buttons on success', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          plans: [
            { tier: 'bronze', amount: 500, available: true, paymentUrl: 'https://buy.stripe.com/bronze' },
            { tier: 'silver', amount: 1000, available: true, paymentUrl: 'https://buy.stripe.com/silver' },
          ],
        }),
      } as Response);

      await loadSupportPlans();

      const btnBronze = document.getElementById('btn-plan-bronze') as HTMLAnchorElement;
      const btnSilver = document.getElementById('btn-plan-silver') as HTMLAnchorElement;
      const cardBronze = btnBronze.closest('.tier-card');

      expect(btnBronze.href).toBe('https://buy.stripe.com/bronze');
      expect(btnBronze.target).toBe('_blank');
      expect(btnBronze.rel).toBe('noopener noreferrer');
      expect(btnBronze.classList.contains('disabled')).toBe(false);
      expect(btnBronze.classList.contains('btn-disabled')).toBe(false);
      expect(btnBronze.hasAttribute('aria-disabled')).toBe(false);
      expect(cardBronze?.classList.contains('tier-disabled')).toBe(false);
      expect(btnBronze.innerHTML).toContain('エナドリを差し入れ（¥500）');
      expect(btnSilver.href).toBe('https://buy.stripe.com/silver');
    });

    it('should disable button and show Coming Soon state when plan is unavailable or paymentUrl is missing', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          plans: [
            { tier: 'nonexistent', amount: 999, available: true, paymentUrl: 'https://buy.stripe.com/other' },
            { tier: 'bronze', amount: 500, available: false, paymentUrl: null },
            { tier: 'silver', amount: 1000, available: true, paymentUrl: '' },
          ],
        }),
      } as Response);

      await loadSupportPlans();

      const btnBronze = document.getElementById('btn-plan-bronze') as HTMLAnchorElement;
      const cardBronze = btnBronze.closest('.tier-card');
      expect(btnBronze.classList.contains('disabled')).toBe(true);
      expect(btnBronze.classList.contains('btn-disabled')).toBe(true);
      expect(btnBronze.hasAttribute('href')).toBe(false);
      expect(btnBronze.getAttribute('aria-disabled')).toBe('true');
      expect(cardBronze?.classList.contains('tier-disabled')).toBe(true);
      expect(btnBronze.innerHTML).toContain('準備中（受付開始までお待ちください）');
      expect(btnBronze.innerHTML).toContain('Coming Soon');

      const btnSilver = document.getElementById('btn-plan-silver') as HTMLAnchorElement;
      expect(btnSilver.classList.contains('btn-disabled')).toBe(true);
      expect(btnSilver.hasAttribute('href')).toBe(false);
    });

    it('should handle plans without closest card safely', async () => {
      document.body.innerHTML = `
        <a id="btn-plan-bronze" class="btn-support btn-bronze" href="#">Coming Soon</a>
      `;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          plans: [
            { tier: 'bronze', amount: 500, available: true, paymentUrl: 'https://buy.stripe.com/bronze' },
          ],
        }),
      } as Response);

      await loadSupportPlans();
      const btnBronze = document.getElementById('btn-plan-bronze') as HTMLAnchorElement;
      expect(btnBronze.href).toBe('https://buy.stripe.com/bronze');
    });

    it('should handle API errors gracefully without throwing', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await loadSupportPlans();

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('loadSupporterCredits', () => {
    it('should render supporter cards with correct tiers and dates', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          credits: [
            { id: '1', safeName: 'Alice', tier: 'gold', createdAt: '2026-10-25T12:00:00Z' },
            { id: '2', safeName: 'MediumSupporterName', tier: 'silver', createdAt: '2026-10-26T12:00:00Z' },
            { id: '3', safeName: 'VeryVeryLongSupporterNameExceedingLimit', tier: 'bronze', createdAt: 'invalid-date' },
            { id: '4', safeName: 'MidLengthName1234', tier: 'bronze', createdAt: '' },
          ],
          total: 250,
          totalPages: 3,
        }),
      } as Response);

      await loadSupporterCredits(1);

      const grid = document.getElementById('roster-grid');
      expect(grid?.children.length).toBe(4);
      expect(grid?.innerHTML).toContain('Alice');
      expect(grid?.innerHTML).toContain('tier-gold');
      expect(grid?.innerHTML).toContain('tier-silver');
      expect(grid?.innerHTML).toContain('tier-bronze');

      const metaBadge = document.getElementById('roster-meta-badge');
      expect(metaBadge?.textContent).toContain('250名のサポーター · P.1/3');
    });

    it('should render single page without page number in badge and fallback missing fields', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          credits: [
            { id: '1', safeName: '', tier: undefined, createdAt: undefined },
          ],
        }),
      } as Response);

      await loadSupporterCredits(1);

      const grid = document.getElementById('roster-grid');
      expect(grid?.children.length).toBe(1);
      expect(grid?.innerHTML).toContain('Anonymous');
      expect(grid?.innerHTML).toContain('tier-bronze');

      const metaBadge = document.getElementById('roster-meta-badge');
      expect(metaBadge?.textContent).not.toContain('· P.');
    });

    it('should return early if roster grid element is missing', async () => {
      document.body.innerHTML = '';
      await expect(loadSupporterCredits(1)).resolves.toBeUndefined();
    });

    it('should trigger DOMContentLoaded event handler cleanly', () => {
      document.dispatchEvent(new Event('DOMContentLoaded'));
    });


    it('should render empty state message when no credits returned', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          credits: [],
          total: 0,
          totalPages: 1,
        }),
      } as Response);

      await loadSupporterCredits(1);

      const grid = document.getElementById('roster-grid');
      expect(grid?.innerHTML).toContain('まだサポーターが登録されていません');
    });

    it('should render error state on fetch failure', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);
      const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await loadSupporterCredits(1);

      const grid = document.getElementById('roster-grid');
      expect(grid?.innerHTML).toContain('名簿の取得に失敗しました');
      errSpy.mockRestore();
    });
  });

  describe('initTiersCarousel', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div class="tiers-carousel-wrapper">
          <div id="tiers-edge-left" class="tiers-edge-indicator left"></div>
          <div id="tiers-edge-right" class="tiers-edge-indicator right"></div>
          <div id="tiers-grid" style="width: 300px; overflow-x: auto;">
            <div class="tier-card" style="width: 250px;">Bronze</div>
            <div class="tier-card" style="width: 250px;">Silver</div>
            <div class="tier-card" style="width: 250px;">Gold</div>
          </div>
          <div id="tiers-carousel-dots">
            <span class="carousel-dot active" data-index="0"></span>
            <span class="carousel-dot" data-index="1"></span>
            <span class="carousel-dot" data-index="2"></span>
          </div>
        </div>
      `;
    });

    it('should return early if tiers-grid does not exist', () => {
      document.body.innerHTML = '';
      expect(() => initTiersCarousel()).not.toThrow();
    });

    it('should initialize carousel and scroll listener in mobile mode', () => {
      // Mock window.innerWidth
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 500 });

      const grid = document.getElementById('tiers-grid') as HTMLElement;
      const edgeLeft = document.getElementById('tiers-edge-left') as HTMLElement;
      const edgeRight = document.getElementById('tiers-edge-right') as HTMLElement;
      const cards = grid.querySelectorAll<HTMLElement>('.tier-card');
      const dots = document.querySelectorAll<HTMLElement>('.carousel-dot');

      // Mock layout properties
      Object.defineProperty(grid, 'clientWidth', { value: 300, configurable: true });
      Object.defineProperty(grid, 'scrollWidth', { value: 900, configurable: true });
      cards.forEach((card, idx) => {
        Object.defineProperty(card, 'offsetLeft', { value: idx * 260, configurable: true });
        Object.defineProperty(card, 'offsetWidth', { value: 250, configurable: true });
        card.scrollIntoView = jest.fn();
      });

      initTiersCarousel();

      // Test scroll updates
      grid.scrollLeft = 50;
      grid.dispatchEvent(new Event('scroll'));

      expect(edgeLeft.classList.contains('active')).toBe(true);
      expect(edgeRight.classList.contains('active')).toBe(true);

      // Scroll to end
      grid.scrollLeft = 600;
      grid.dispatchEvent(new Event('scroll'));
      expect(edgeRight.classList.contains('active')).toBe(false);

      // Click dot
      dots[1]?.dispatchEvent(new Event('click'));
      expect(cards[1]?.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });

      // Window resize
      window.dispatchEvent(new Event('resize'));
    });

    it('should not update edges if window is desktop (>900px)', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1200 });
      const grid = document.getElementById('tiers-grid') as HTMLElement;
      const edgeLeft = document.getElementById('tiers-edge-left') as HTMLElement;

      initTiersCarousel();
      grid.scrollLeft = 100;
      grid.dispatchEvent(new Event('scroll'));

      expect(edgeLeft.classList.contains('active')).toBe(false);
    });
  });

  describe('renderRecentSupporters', () => {
    it('returns early when #recent-supporters-list is missing', () => {
      document.body.innerHTML = '';
      expect(() => renderRecentSupporters([{ tier: 'bronze', safeName: 'Test' }])).not.toThrow();
    });

    it('renders empty placeholder when list is empty or undefined', () => {
      renderRecentSupporters([]);
      const el = document.getElementById('recent-supporters-list');
      expect(el?.innerHTML).toContain('まだ直近のご支援はありません');

      renderRecentSupporters(undefined as any);
      expect(el?.innerHTML).toContain('まだ直近のご支援はありません');
    });

    it('renders chips for gold, silver, bronze tiers with fallback name when empty', () => {
      renderRecentSupporters([
        { tier: 'gold', safeName: 'GoldMember' },
        { tier: 'silver', safeName: 'SilverMember' },
        { tier: 'bronze', safeName: '' },
        { tier: 'invalid', safeName: 'Other' },
      ]);
      const el = document.getElementById('recent-supporters-list');
      expect(el?.children.length).toBe(4);
      expect(el?.innerHTML).toContain('GoldMember');
      expect(el?.innerHTML).toContain('SilverMember');
      expect(el?.innerHTML).toContain('Anonymous Master');
      expect(el?.innerHTML).toContain('tier-gold');
      expect(el?.innerHTML).toContain('tier-silver');
      expect(el?.innerHTML).toContain('tier-bronze');
    });
  });
});

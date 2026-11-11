import {
  loadSupportPlans,
  loadSupporterCredits,
  renderRecentSupporters,
  escapeHtml,
  getNameFontClass,
  formatDateYMD,
  initTiersCarousel,
  openSupporterModal,
  closeSupporterModal,
  onBackdropClick,
  renderPagination,
  goToPage,
  initSupportersModalEvents,
  supportPlansMap,
} from '../src/scripts/supporters';

describe('Client Script - Supporters Roster & Plans', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="recent-supporters-list"></div>
      <div id="roster-grid"></div>
      <div id="roster-meta-badge"></div>
      <div id="roster-pagination"></div>
      <div class="tier-card tier-bronze">
        <div class="tier-price">¥500 <span><span class="t-ja">/ 一口</span><span class="t-en">/ slot</span></span></div>
        <a id="btn-plan-bronze" class="btn-support btn-bronze btn-loading disabled" aria-disabled="true">
          <span class="btn-spinner" aria-hidden="true"></span>
          <span class="t-ja">プラン読込中...</span>
          <span class="t-en">Loading...</span>
        </a>
      </div>
      <div class="tier-card tier-silver featured">
        <div class="tier-price">¥1,000 <span><span class="t-ja">/ 一口</span><span class="t-en">/ slot</span></span></div>
        <a id="btn-plan-silver" class="btn-support btn-silver primary btn-loading disabled" aria-disabled="true">
          <span class="btn-spinner" aria-hidden="true"></span>
          <span class="t-ja">プラン読込中...</span>
          <span class="t-en">Loading...</span>
        </a>
      </div>
      <div class="tier-card tier-gold">
        <div class="tier-price">¥3,000 <span><span class="t-ja">/ 一口</span><span class="t-en">/ slot</span></span></div>
        <a id="btn-plan-gold" class="btn-support btn-gold btn-loading disabled" aria-disabled="true">
          <span class="btn-spinner" aria-hidden="true"></span>
          <span class="t-ja">プラン読込中...</span>
          <span class="t-en">Loading...</span>
        </a>
      </div>
      <div id="supporter-modal" class="modal-overlay" role="dialog" aria-modal="true" aria-hidden="true">
        <div class="modal-card">
          <button type="button" class="modal-close-btn" id="modal-close-btn" aria-label="Close modal">×</button>
          <div id="modal-tier-badge" class="modal-tier-badge">
            <div id="modal-rank-icon" class="modal-rank-icon"></div>
            <span id="modal-tier-text" class="modal-tier-text"></span>
          </div>
          <h3 id="modal-supporter-name" class="modal-supporter-name"></h3>
          <div id="modal-plan-title" class="modal-plan-title"></div>
          <div class="modal-details-grid">
            <div class="modal-detail-row">
              <span id="modal-tier-val" class="detail-val"></span>
            </div>
            <div class="modal-detail-row">
              <span id="modal-date-val" class="detail-val"></span>
            </div>
          </div>
        </div>
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

    it('should handle API errors gracefully and fallback buttons to Coming Soon', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await loadSupportPlans();

      expect(warnSpy).toHaveBeenCalled();
      const btnBronze = document.getElementById('btn-plan-bronze') as HTMLAnchorElement;
      const cardBronze = btnBronze.closest('.tier-card');
      expect(btnBronze.classList.contains('btn-loading')).toBe(false);
      expect(btnBronze.classList.contains('btn-disabled')).toBe(true);
      expect(btnBronze.getAttribute('aria-disabled')).toBe('true');
      expect(cardBronze?.classList.contains('tier-disabled')).toBe(true);
      expect(btnBronze.innerHTML).toContain('準備中（受付開始までお待ちください）');

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

      // Click card to open modal
      const firstCard = grid?.querySelector('.roster-card') as HTMLElement;
      expect(firstCard).not.toBeNull();
      firstCard.click();
      const modal = document.getElementById('supporter-modal');
      expect(modal?.classList.contains('open')).toBe(true);
      expect(document.getElementById('modal-supporter-name')?.textContent).toBe('Alice');
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

      // Scroll back to start to test edgeLeft remove active branch
      grid.scrollLeft = 5;
      grid.dispatchEvent(new Event('scroll'));
      expect(edgeLeft.classList.contains('active')).toBe(false);

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

    it('opens supporter detail modal when recent supporter chip is clicked', () => {
      renderRecentSupporters([{ tier: 'gold', safeName: 'ActiveChipUser', createdAt: '2026-11-01T00:00:00Z' }]);
      const chip = document.querySelector('.recent-chip') as HTMLElement;
      expect(chip).not.toBeNull();
      chip.click();

      const modal = document.getElementById('supporter-modal');
      expect(modal?.classList.contains('open')).toBe(true);
      expect(document.getElementById('modal-supporter-name')?.textContent).toBe('ActiveChipUser');
      expect(document.getElementById('modal-tier-val')?.textContent).toBe('GOLD');
    });
  });

  describe('Supporter Detail Modal & Events', () => {
    it('returns early when #supporter-modal element is missing', () => {
      document.body.innerHTML = '';
      expect(() => openSupporterModal({ tier: 'gold', safeName: 'Nobody' })).not.toThrow();
      expect(() => closeSupporterModal()).not.toThrow();
    });

    it('populates and opens modal with dynamic plan details and formatting', () => {
      supportPlansMap.silver = {
        tier: 'silver',
        amount: 1000,
        itemLabel: 'サーバーリソース差し入れ',
        displayName: 'Compute Resource',
      };

      openSupporterModal({
        tier: 'silver',
        safeName: 'Alice Master',
        createdAt: '2026-10-25T12:00:00Z',
      });

      const modal = document.getElementById('supporter-modal');
      expect(modal?.classList.contains('open')).toBe(true);
      expect(modal?.getAttribute('aria-hidden')).toBe('false');
      expect(document.body.style.overflow).toBe('hidden');

      expect(document.getElementById('modal-tier-badge')?.className).toContain('tier-silver');
      expect(document.getElementById('modal-tier-text')?.textContent).toBe('SILVER SPONSOR');
      expect(document.getElementById('modal-supporter-name')?.textContent).toBe('Alice Master');
      expect(document.getElementById('modal-plan-title')?.innerHTML).toContain('サーバーリソース差し入れ');
      expect(document.getElementById('modal-tier-val')?.textContent).toBe('SILVER');
      expect(document.getElementById('modal-date-val')?.textContent).toBe('2026/10/25');
    });

    it('falls back to default plan text when plan is not cached in supportPlansMap', () => {
      delete supportPlansMap.gold;
      delete supportPlansMap.bronze;
      openSupporterModal({
        tier: 'gold',
        safeName: '',
        createdAt: '2026-10-20T00:00:00Z',
      });

      expect(document.getElementById('modal-supporter-name')?.textContent).toBe('Anonymous Master');
      expect(document.getElementById('modal-plan-title')?.innerHTML).toContain('開発サポート（¥3,000）');
      expect(document.getElementById('modal-tier-val')?.textContent).toBe('GOLD');

      // Bronze tier fallback without plan in supportPlansMap
      openSupporterModal({
        tier: 'bronze',
        safeName: 'BronzeUser',
        createdAt: '2026-10-20T00:00:00Z',
      });
      expect(document.getElementById('modal-plan-title')?.innerHTML).toContain('エナドリ1本差し入れ（¥500）');

      // Bronze tier with plan lacking itemLabel and displayName
      supportPlansMap.bronze = { tier: 'bronze', amount: 500 };
      openSupporterModal({
        tier: 'bronze',
        safeName: 'BronzeUser',
        createdAt: '2026-10-20T00:00:00Z',
      });
      expect(document.getElementById('modal-plan-title')?.innerHTML).toContain('ご支援（¥500）');
    });

    it('closes modal properly via closeSupporterModal', () => {
      openSupporterModal({ tier: 'bronze', safeName: 'TestUser' });
      const modal = document.getElementById('supporter-modal');
      expect(modal?.classList.contains('open')).toBe(true);

      closeSupporterModal();
      expect(modal?.classList.contains('open')).toBe(false);
      expect(modal?.getAttribute('aria-hidden')).toBe('true');
      expect(document.body.style.overflow).toBe('');
    });

    it('handles backdrop click correctly', () => {
      openSupporterModal({ tier: 'bronze', safeName: 'TestUser' });
      const modal = document.getElementById('supporter-modal') as HTMLElement;

      // Click on backdrop
      onBackdropClick({ target: modal } as unknown as MouseEvent);
      expect(modal.classList.contains('open')).toBe(false);

      // Click inside modal card (should not close)
      openSupporterModal({ tier: 'bronze', safeName: 'TestUser' });
      const card = modal.querySelector('.modal-card') as HTMLElement;
      onBackdropClick({ target: card } as unknown as MouseEvent);
      expect(modal.classList.contains('open')).toBe(true);
    });

    it('attaches event listeners via initSupportersModalEvents', () => {
      initSupportersModalEvents();

      openSupporterModal({ tier: 'bronze', safeName: 'TestUser' });
      const modal = document.getElementById('supporter-modal') as HTMLElement;
      const closeBtn = document.getElementById('modal-close-btn') as HTMLElement;

      // Close button click
      closeBtn.click();
      expect(modal.classList.contains('open')).toBe(false);

      // Escape key press
      openSupporterModal({ tier: 'bronze', safeName: 'TestUser' });
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(modal.classList.contains('open')).toBe(false);
    });
  });

  describe('renderPagination & Navigation', () => {
    it('returns early when #roster-pagination is missing', () => {
      document.getElementById('roster-pagination')?.remove();
      expect(() => renderPagination(1, 5, 50)).not.toThrow();
    });

    it('renders single-page summary when totalPages <= 1', () => {
      renderPagination(1, 1, 15);
      const el = document.getElementById('roster-pagination');
      expect(el?.innerHTML).toContain('全 15 名のマスターを表示中');

      renderPagination(1, 0, 0);
      expect(el?.innerHTML).toBe('');
    });

    it('renders multi-page pagination with prev, next, ellipsis, and page numbers', () => {
      renderPagination(5, 10, 1200);
      const el = document.getElementById('roster-pagination') as HTMLElement;
      expect(el.innerHTML).toContain('pagination-prev');
      expect(el.innerHTML).toContain('pagination-next');
      expect(el.innerHTML).toContain('pagination-ellipsis');
      expect(el.innerHTML).toContain('data-page="1"');
      expect(el.innerHTML).toContain('data-page="5"');
      expect(el.innerHTML).toContain('data-page="10"');
    });

    it('disables prev button on first page and next button on last page', () => {
      renderPagination(1, 5, 500);
      const prevBtn = document.querySelector('.pagination-prev') as HTMLButtonElement;
      expect(prevBtn.disabled).toBe(true);

      renderPagination(5, 5, 500);
      const nextBtn = document.querySelector('.pagination-next') as HTMLButtonElement;
      expect(nextBtn.disabled).toBe(true);
    });

    it('clicking pagination page button invokes goToPage', () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ credits: [], total: 100, totalPages: 5 }),
      });
      const scrollIntoViewMock = jest.fn();
      const rosterEl = document.createElement('div');
      rosterEl.id = 'roster';
      rosterEl.scrollIntoView = scrollIntoViewMock;
      document.body.appendChild(rosterEl);

      renderPagination(1, 5, 100);
      const pageBtn = document.querySelector('button[data-page="2"]') as HTMLButtonElement;
      pageBtn.click();

      expect(global.fetch).toHaveBeenCalledWith('/api/v1/support/credits?page=2&limit=120');
      expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth' });
    });
  });
});

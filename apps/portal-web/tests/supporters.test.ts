import {
  loadSupportPlans,
  loadSupporterCredits,
  escapeHtml,
  getNameFontClass,
  formatDateYMD,
} from '../src/scripts/supporters';

describe('Client Script - Supporters Roster & Plans', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="roster-grid"></div>
      <div id="roster-meta-badge"></div>
      <div id="roster-pagination"></div>
      <a id="btn-plan-bronze" class="disabled" href="#">Bronze</a>
      <a id="btn-plan-silver" class="disabled" href="#">Silver</a>
      <a id="btn-plan-gold" class="disabled" href="#">Gold</a>
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
    it('should attach payment URLs and enable buttons on success', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          plans: [
            { tier: 'bronze', paymentUrl: 'https://buy.stripe.com/bronze' },
            { tier: 'silver', paymentUrl: 'https://buy.stripe.com/silver' },
          ],
        }),
      } as Response);

      await loadSupportPlans();

      const btnBronze = document.getElementById('btn-plan-bronze') as HTMLAnchorElement;
      const btnSilver = document.getElementById('btn-plan-silver') as HTMLAnchorElement;

      expect(btnBronze.href).toBe('https://buy.stripe.com/bronze');
      expect(btnBronze.classList.contains('disabled')).toBe(false);
      expect(btnSilver.href).toBe('https://buy.stripe.com/silver');
    });

    it('should ignore plans with missing button or missing paymentUrl', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          plans: [
            { tier: 'nonexistent', paymentUrl: 'https://buy.stripe.com/other' },
            { tier: 'bronze', paymentUrl: '' },
          ],
        }),
      } as Response);

      await loadSupportPlans();
      const btnBronze = document.getElementById('btn-plan-bronze') as HTMLAnchorElement;
      expect(btnBronze.classList.contains('disabled')).toBe(true);
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
});

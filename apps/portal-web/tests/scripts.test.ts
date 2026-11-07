import { setLanguage, initSupportPlanLinks } from '../src/scripts/main';

describe('Client Script - Language Switching', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="btn-lang-ja" class="lang-btn active">JA</button>
      <button id="btn-lang-en" class="lang-btn">EN</button>
    `;
    localStorage.clear();
  });

  it('should switch attributes to en and update button classes', () => {
    setLanguage('en');
    expect(document.body.getAttribute('data-lang')).toBe('en');
    expect(document.documentElement.getAttribute('lang')).toBe('en');

    const btnJa = document.getElementById('btn-lang-ja');
    const btnEn = document.getElementById('btn-lang-en');
    expect(btnEn?.classList.contains('active')).toBe(true);
    expect(btnJa?.classList.contains('active')).toBe(false);
    expect(localStorage.getItem('portal_lang')).toBe('en');
  });

  it('should switch attributes back to ja', () => {
    setLanguage('en');
    setLanguage('ja');
    expect(document.body.getAttribute('data-lang')).toBe('ja');
    expect(document.documentElement.getAttribute('lang')).toBe('ja');

    const btnJa = document.getElementById('btn-lang-ja');
    const btnEn = document.getElementById('btn-lang-en');
    expect(btnJa?.classList.contains('active')).toBe(true);
    expect(btnEn?.classList.contains('active')).toBe(false);
  });

  it('should trigger DOMContentLoaded event handler and restore saved language', () => {
    localStorage.setItem('portal_lang', 'en');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    expect(document.body.getAttribute('data-lang')).toBe('en');

    localStorage.setItem('portal_lang', 'ja');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    expect(document.body.getAttribute('data-lang')).toBe('ja');
  });

  it('should fallback to ja if stored language is neither ja nor en', () => {
    localStorage.setItem('portal_lang', 'fr');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    expect(document.body.getAttribute('data-lang')).toBe('ja');
  });

  it('should not throw if buttons are missing from DOM', () => {
    document.body.innerHTML = '';
    expect(() => setLanguage('en')).not.toThrow();
  });

  it('should handle localStorage throwing error gracefully', () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Quota exceeded');
    });

    expect(() => setLanguage('ja')).not.toThrow();
    setItemSpy.mockRestore();
  });
});

describe('Client Script - Landing Support Plan Links', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    document.body.innerHTML = `
      <a href="javascript:void(0)" id="lp-tier-bronze" class="tier-box bronze-tier tier-disabled" aria-disabled="true">
        <span class="tier-status-pill">受付準備中</span>
        <span class="tier-arrow-icon" style="display: none;">Arrow</span>
      </a>
      <a href="javascript:void(0)" id="lp-tier-silver" class="tier-box silver-tier tier-disabled" aria-disabled="true">
        <span class="tier-status-pill">受付準備中</span>
        <span class="tier-arrow-icon" style="display: none;">Arrow</span>
      </a>
    `;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should activate LP tier cards when plans are available with paymentUrl', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        plans: [
          { tier: 'bronze', available: true, paymentUrl: 'https://buy.stripe.com/bronze' },
          { tier: 'silver', available: false, paymentUrl: null },
        ],
      }),
    } as Response);

    await initSupportPlanLinks();

    const bronze = document.getElementById('lp-tier-bronze') as HTMLAnchorElement;
    expect(bronze.href).toBe('https://buy.stripe.com/bronze');
    expect(bronze.target).toBe('_blank');
    expect(bronze.rel).toBe('noopener noreferrer');
    expect(bronze.classList.contains('tier-disabled')).toBe(false);
    expect(bronze.hasAttribute('aria-disabled')).toBe(false);

    const silver = document.getElementById('lp-tier-silver') as HTMLAnchorElement;
    expect(silver.hasAttribute('href')).toBe(false);
    expect(silver.classList.contains('tier-disabled')).toBe(true);
    expect(silver.getAttribute('aria-disabled')).toBe('true');
  });

  it('should gracefully handle non-ok or failed API responses', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    await expect(initSupportPlanLinks()).resolves.not.toThrow();

    const bronze = document.getElementById('lp-tier-bronze') as HTMLAnchorElement;
    expect(bronze.classList.contains('tier-disabled')).toBe(true);
  });

  it('should handle missing data.plans or nonexistent DOM elements safely', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        plans: [
          { tier: 'nonexistent', available: true, paymentUrl: 'https://buy.stripe.com/nonexistent' },
        ],
      }),
    } as Response);

    await expect(initSupportPlanLinks()).resolves.not.toThrow();

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    await expect(initSupportPlanLinks()).resolves.not.toThrow();
  });

  it('should handle tier element without pill or arrow icon safely', async () => {
    document.body.innerHTML = `
      <a id="lp-tier-bronze" class="tier-box tier-disabled"></a>
      <a id="lp-tier-silver" class="tier-box tier-disabled"></a>
    `;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        plans: [
          { tier: 'bronze', available: true, paymentUrl: 'https://buy.stripe.com/bronze' },
          { tier: 'silver', available: false, paymentUrl: null },
        ],
      }),
    } as Response);

    await expect(initSupportPlanLinks()).resolves.not.toThrow();
    const bronze = document.getElementById('lp-tier-bronze') as HTMLAnchorElement;
    expect(bronze.classList.contains('tier-disabled')).toBe(false);
  });
});

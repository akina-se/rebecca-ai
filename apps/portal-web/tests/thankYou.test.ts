import { checkSessionVerification } from '../src/scripts/thankYou';

describe('Client Script - Thank You Session Verification', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="reward-panel" style="display:none;">
        <span id="supporter-name-display"></span>
        <span id="supporter-name-display-en"></span>
        <span id="tier-badge-pill"></span>
        <span class="item-label-display"></span>
        <a id="download-reward-btn" class="disabled" href="#">Download</a>
      </div>
      <div id="guidance-card"></div>
    `;
    window.history.replaceState(null, '', '/support/thank-you.html');
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should verify session and display reward panel on valid session_id', async () => {
    window.history.replaceState(null, '', '/support/thank-you.html?session_id=cs_test_123');

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        valid: true,
        supporterName: 'Master Alice',
        tier: 'gold',
        itemLabel: 'Special Support',
        downloadUrl: 'https://storage.googleapis.com/download-link',
      }),
    } as Response);

    await checkSessionVerification();

    const rewardPanel = document.getElementById('reward-panel');
    const guidanceCard = document.getElementById('guidance-card');
    const nameDisplay = document.getElementById('supporter-name-display');
    const badgePill = document.getElementById('tier-badge-pill');
    const dlBtn = document.getElementById('download-reward-btn') as HTMLAnchorElement;

    expect(rewardPanel?.style.display).toBe('block');
    expect(guidanceCard?.style.display).toBe('none');
    expect(nameDisplay?.textContent).toBe('Master Alice');
    expect(badgePill?.textContent).toBe('GOLD TIER');
    expect(dlBtn?.href).toBe('https://storage.googleapis.com/download-link');
    expect(dlBtn?.classList.contains('disabled')).toBe(false);

    // Verify session_id was scrubbed from URL
    expect(window.location.search).toBe('');
  });

  it('should preserve other query params when scrubbing session_id and use JA fallbacks', async () => {
    document.body.removeAttribute('data-lang');
    window.history.replaceState(null, '', '/support/thank-you.html?session_id=cs_test_123&ref=twitter');

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        valid: true,
        supporterName: '',
        tier: undefined,
        itemLabel: '',
        downloadUrl: '',
      }),
    } as Response);

    await checkSessionVerification();

    expect(window.location.search).toBe('?ref=twitter');
    const nameDisplay = document.getElementById('supporter-name-display');
    expect(nameDisplay?.textContent).toBe('マスター');
    const badgePill = document.getElementById('tier-badge-pill');
    expect(badgePill?.textContent).toBe('BRONZE TIER');
    const itemDisplay = document.querySelector('.item-label-display');
    expect(itemDisplay?.textContent).toBe('温かいご支援');
  });

  it('should fallback to default supporter name in English mode when supporterName is blank', async () => {
    document.body.setAttribute('data-lang', 'en');
    window.history.replaceState(null, '', '/support/thank-you.html?session_id=cs_test_en');

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        valid: true,
        supporterName: '',
        tier: 'silver',
        itemLabel: '',
        downloadUrl: 'https://example.com/dl',
      }),
    } as Response);

    await checkSessionVerification();

    const nameDisplay = document.getElementById('supporter-name-display');
    expect(nameDisplay?.textContent).toBe('Master');
  });

  it('should trigger DOMContentLoaded event handler cleanly', () => {
    document.dispatchEvent(new Event('DOMContentLoaded'));
  });

  it('should run safely if DOM elements are missing', async () => {
    document.body.innerHTML = '';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        valid: true,
        supporterName: 'Master Alice',
        downloadUrl: '',
      }),
    } as Response);

    await expect(checkSessionVerification()).resolves.toBeUndefined();
  });

  it('should keep guidance card visible when visiting without session_id and unauthenticated', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ valid: false }),
    } as Response);

    await checkSessionVerification();

    const rewardPanel = document.getElementById('reward-panel');
    const guidanceCard = document.getElementById('guidance-card');

    expect(rewardPanel?.style.display).toBe('none');
    expect(guidanceCard?.style.display).toBe('');
  });

  it('should handle network errors without crashing', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network offline'));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await checkSessionVerification();

    expect(warnSpy).toHaveBeenCalledWith('[ThankYou] Session verification request failed:', expect.any(Error));
    warnSpy.mockRestore();
  });
});

import { checkSessionVerification } from '../src/scripts/thankYou';

describe('thankYou script', () => {
  beforeEach(() => {
    document.body.setAttribute('data-lang', 'ja');
    document.body.innerHTML = `
      <div id="guidance-card" style="display: block;"></div>
      <div id="reward-panel" style="display: none;">
        <span id="supporter-name-display"></span>
        <span id="supporter-name-display-en"></span>
        <span id="tier-badge-pill"></span>
        <span class="item-label-display"></span>
        <a id="download-reward-btn" class="disabled" href="#">Download</a>
      </div>
    `;
    window.history.replaceState({}, '', '/support/thank-you.html?session_id=cs_test_123');
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Check session without sessionId and failed verification returns early without showing reward panel', async () => {
    window.history.replaceState({}, '', '/support/thank-you.html');
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ valid: false, error: 'Missing session' }),
    });

    await checkSessionVerification();

    expect(global.fetch).toHaveBeenCalledWith('/api/v1/support/verify-session', {
      method: 'GET',
      headers: {},
      credentials: 'same-origin',
    });
    expect(document.getElementById('reward-panel')?.style.display).toBe('none');
    expect(document.getElementById('guidance-card')?.style.display).toBe('block');
  });

  it('Verifies session via x-stripe-session-id header, scrubs URL, and unlocks reward download button', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        valid: true,
        tier: 'gold',
        itemLabel: '開発サポート',
        supporterName: 'レベッカ推し',
        reward: {
          title: 'サポーター特典イラスト',
          thumbnailUrl: '/api/v1/support/rewards/download?type=thumbnail',
          downloadUrl: '/api/v1/support/rewards/download?type=master',
          expiresAt: '2026-10-25T12:30:00.000Z',
        },
        isExpired: false,
      }),
    });

    await checkSessionVerification();

    expect(window.location.search).toBe('');
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/support/verify-session', {
      method: 'GET',
      headers: { 'x-stripe-session-id': 'cs_test_123' },
      credentials: 'same-origin',
    });
    expect(document.getElementById('guidance-card')?.style.display).toBe('none');
    expect(document.getElementById('reward-panel')?.style.display).toBe('block');
    expect(document.getElementById('supporter-name-display')?.textContent).toBe('レベッカ推し');
    expect(document.getElementById('tier-badge-pill')?.textContent).toBe('GOLD TIER');
    expect(document.querySelector('.item-label-display')?.textContent).toBe('開発サポート');

    const dlBtn = document.getElementById('download-reward-btn') as HTMLAnchorElement;
    expect(dlBtn.classList.contains('disabled')).toBe(false);
    expect(dlBtn.getAttribute('href')).toBe('/api/v1/support/rewards/download?type=master');
  });

  it('Falls back to localized default supporter name and item label when supporterName is null or blank in English mode', async () => {
    document.body.setAttribute('data-lang', 'en');
    window.history.replaceState({}, '', '/support/thank-you.html?session_id=cs_test_en&lang=en');
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        valid: true,
        tier: 'bronze',
        itemLabel: '   ',
        supporterName: null,
        reward: null,
        isExpired: false,
      }),
    });

    await checkSessionVerification();

    expect(window.location.search).toBe('?lang=en');
    expect(document.getElementById('supporter-name-display')?.textContent).toBe('Master');
    expect(document.querySelector('.item-label-display')?.textContent).toBe('Contribution');
    const dlBtn = document.getElementById('download-reward-btn') as HTMLAnchorElement;
    expect(dlBtn.classList.contains('disabled')).toBe(true);
  });

  it('Falls back to Japanese defaults when supporterName and itemLabel are blank in Japanese mode', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        valid: true,
        tier: 'silver',
        itemLabel: '',
        supporterName: '   ',
        reward: null,
        isExpired: false,
      }),
    });

    await checkSessionVerification();

    expect(document.getElementById('supporter-name-display')?.textContent).toBe('マスター');
    expect(document.querySelector('.item-label-display')?.textContent).toBe('温かいご支援');
  });

  it('Keeps #download-reward-btn disabled when isExpired is true', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        valid: true,
        tier: 'silver',
        itemLabel: 'サーバーリソース差し入れ',
        supporterName: 'テストマスター',
        reward: null,
        isExpired: true,
      }),
    });

    await checkSessionVerification();

    const dlBtn = document.getElementById('download-reward-btn') as HTMLAnchorElement;
    expect(dlBtn.classList.contains('disabled')).toBe(true);
    expect(dlBtn.getAttribute('href')).toBe('#');
  });

  it('Logs warning when fetch throws a network error', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    await checkSessionVerification();

    expect(warnSpy).toHaveBeenCalledWith('[ThankYou] Session verification request failed:', expect.any(Error));
  });
});

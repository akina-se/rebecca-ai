import { checkSessionVerification } from '../src/scripts/thankYou';

describe('thankYou script', () => {
  beforeEach(() => {
    document.body.setAttribute('data-lang', 'ja');
    document.body.innerHTML = `
      <div id="loading-card" style="display: flex;"></div>
      <div id="guidance-card" style="display: none;"></div>
      <div id="reward-panel" style="display: none;">
        <span id="supporter-name-display"></span>
        <span id="supporter-name-display-en"></span>
        <span id="tier-badge-pill"></span>
        <span class="item-label-display item-label-display-ja"></span>
        <span class="item-label-display item-label-display-en"></span>
        <span class="item-label-display"></span>
        <div id="reward-asset-container" style="display: none;">
          <div id="reward-image-frame">
            <img id="reward-image" style="display: none;" src="" />
            <div id="reward-placeholder-expired" style="display: none;"></div>
            <div id="reward-placeholder-error" style="display: none;"></div>
          </div>
          <a id="download-reward-btn" class="disabled" href="#">
            <span class="t-ja">高画質イラストをダウンロード</span>
            <span class="t-en">Download High-Res Illustration</span>
          </a>
          <div id="reward-expiry-timer" style="display: block;"></div>
        </div>
        <div class="dl-alert-box" style="display: block;"></div>
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
    expect(document.getElementById('loading-card')?.style.display).toBe('none');
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
    expect(document.getElementById('loading-card')?.style.display).toBe('none');
    expect(document.getElementById('guidance-card')?.style.display).toBe('none');
    expect(document.getElementById('reward-panel')?.style.display).toBe('block');
    expect(document.getElementById('supporter-name-display')?.textContent).toBe('レベッカ推し');
    expect(document.getElementById('supporter-name-display-en')?.textContent).toBe('レベッカ推し');
    expect(document.getElementById('tier-badge-pill')?.textContent).toBe('GOLD TIER');
    expect(document.querySelector('.item-label-display-ja')?.textContent).toBe('開発サポート');
    expect(document.querySelector('.item-label-display-en')?.textContent).toBe('Development Support');

    const rewardImg = document.getElementById('reward-image') as HTMLImageElement;
    expect(rewardImg.style.display).toBe('block');
    expect(rewardImg.src).toContain('/api/v1/support/rewards/download?type=thumbnail');

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
    expect(document.getElementById('supporter-name-display')?.textContent).toBe('マスター');
    expect(document.getElementById('supporter-name-display-en')?.textContent).toBe('Master');
    expect(document.querySelector('.item-label-display-en')?.textContent).toBe('Energy Drink');
    expect(document.querySelector('.item-label-display-ja')?.textContent).toBe('温かいご支援');
    const dlBtn = document.getElementById('download-reward-btn') as HTMLAnchorElement;
    expect(dlBtn.classList.contains('disabled')).toBe(true);
  });

  it('Falls back to Master / マスター when supporterName is Anonymous Master', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        valid: true,
        tier: 'custom_tier',
        itemLabel: 'Custom Support',
        supporterName: 'Anonymous Master',
        reward: null,
        isExpired: false,
      }),
    });

    await checkSessionVerification();

    expect(document.getElementById('supporter-name-display')?.textContent).toBe('マスター');
    expect(document.getElementById('supporter-name-display-en')?.textContent).toBe('Master');
    expect(document.querySelector('.item-label-display-en')?.textContent).toBe('Custom Support');
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

  it('Shows expired placeholder and updates download button when isExpired is true', async () => {
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
    expect(dlBtn.hasAttribute('href')).toBe(false);
    expect(dlBtn.querySelector('.t-ja')?.textContent).toBe('ダウンロード期限終了');
    expect(dlBtn.querySelector('.t-en')?.textContent).toBe('Download Window Closed');

    const expiredPlaceholder = document.getElementById('reward-placeholder-expired');
    expect(expiredPlaceholder?.style.display).toBe('flex');

    const alertBox = document.querySelector('.dl-alert-box') as HTMLElement;
    expect(alertBox?.style.display).toBe('none');

    const timer = document.getElementById('reward-expiry-timer');
    expect(timer?.style.display).toBe('none');
  });

  it('Shows error placeholder when reward image loading encounters an error', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        valid: true,
        tier: 'gold',
        itemLabel: '開発サポート',
        supporterName: 'テストマスター',
        reward: {
          title: 'サポーター特典イラスト',
          thumbnailUrl: '/invalid/image/path.jpg',
          downloadUrl: '/valid/download.jpg',
          expiresAt: '2026-10-25T12:30:00.000Z',
        },
        isExpired: false,
      }),
    });

    await checkSessionVerification();

    const img = document.getElementById('reward-image') as HTMLImageElement;
    expect(img.style.display).toBe('block');

    // Trigger image error
    img.dispatchEvent(new Event('error'));

    const errorPlaceholder = document.getElementById('reward-placeholder-error');
    expect(errorPlaceholder?.style.display).toBe('flex');
    expect(img.style.display).toBe('none');
  });

  it('Displays error guidance card when session verification returns valid: false', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        valid: false,
        error: 'Invalid session',
      }),
    });

    await checkSessionVerification();

    const guidanceCard = document.getElementById('guidance-card');
    expect(guidanceCard?.style.display).toBe('block');
    expect(guidanceCard?.innerHTML).toContain('セッション検証エラー');
    expect(guidanceCard?.innerHTML).toContain('サポーターページへ');
    expect(document.getElementById('reward-panel')?.style.display).toBe('none');
  });

  it('Logs warning when fetch throws a network error', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    await checkSessionVerification();

    expect(warnSpy).toHaveBeenCalledWith('[ThankYou] Session verification request failed:', expect.any(Error));
    expect(document.getElementById('loading-card')?.style.display).toBe('none');
    expect(document.getElementById('guidance-card')?.style.display).toBe('block');
    expect(document.getElementById('reward-panel')?.style.display).toBe('none');
  });

  it('Falls back to Master when supporterName is 名無しのマスター', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        valid: true,
        tier: 'other_tier',
        itemLabel: '',
        supporterName: '名無しのマスター',
        reward: null,
        isExpired: false,
      }),
    });

    await checkSessionVerification();

    expect(document.getElementById('supporter-name-display')?.textContent).toBe('マスター');
    expect(document.getElementById('supporter-name-display-en')?.textContent).toBe('Master');
    expect(document.querySelector('.item-label-display-en')?.textContent).toBe('Contribution');
  });

  it('Handles reward with only downloadUrl (no previewUrl)', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        valid: true,
        tier: 'gold',
        itemLabel: '開発サポート',
        supporterName: 'テストマスター',
        reward: {
          title: 'サポーター特典イラスト',
          thumbnailUrl: '',
          downloadUrl: '/valid/download.jpg',
          expiresAt: '2026-10-25T12:30:00.000Z',
        },
        isExpired: false,
      }),
    });

    await checkSessionVerification();

    const img = document.getElementById('reward-image') as HTMLImageElement;
    expect(img.style.display).toBe('none');
    const dlBtn = document.getElementById('download-reward-btn') as HTMLAnchorElement;
    expect(dlBtn.classList.contains('disabled')).toBe(false);
  });

  it('Handles reward with neither previewUrl nor downloadUrl', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        valid: true,
        tier: 'gold',
        itemLabel: '開発サポート',
        supporterName: 'テストマスター',
        reward: {
          title: 'サポーター特典イラスト',
          thumbnailUrl: '',
          downloadUrl: '',
          expiresAt: '2026-10-25T12:30:00.000Z',
        },
        isExpired: false,
      }),
    });

    await checkSessionVerification();

    const img = document.getElementById('reward-image') as HTMLImageElement;
    expect(img.style.display).toBe('none');
  });

  it('Handles DOM gracefully when optional sub-elements in reward-panel are missing', async () => {
    document.body.innerHTML = `
      <div id="reward-panel" style="display: none;"></div>
      <div id="loading-card" style="display: flex;"></div>
      <div id="guidance-card" style="display: none;"></div>
    `;

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        valid: true,
        tier: 'gold',
        itemLabel: '開発サポート',
        supporterName: 'テストマスター',
        reward: {
          title: 'サポーター特典イラスト',
          thumbnailUrl: '/valid/thumb.jpg',
          downloadUrl: '/valid/download.jpg',
          expiresAt: '2026-10-25T12:30:00.000Z',
        },
        isExpired: false,
      }),
    });

    await checkSessionVerification();

    expect(document.getElementById('reward-panel')?.style.display).toBe('block');
    expect(document.getElementById('guidance-card')?.style.display).toBe('none');
  });

  it('Handles DOM gracefully when optional sub-elements in reward-panel are missing in expired state', async () => {
    document.body.innerHTML = `
      <div id="reward-panel" style="display: none;"></div>
      <div id="loading-card" style="display: flex;"></div>
      <div id="guidance-card" style="display: none;"></div>
    `;

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        valid: true,
        tier: 'silver',
        itemLabel: '開発サポート',
        supporterName: 'テストマスター',
        reward: null,
        isExpired: true,
      }),
    });

    await checkSessionVerification();

    expect(document.getElementById('reward-panel')?.style.display).toBe('block');
  });

  it('Triggers verification on DOMContentLoaded', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ valid: false }),
    });

    document.dispatchEvent(new Event('DOMContentLoaded'));
    // Wait for promise resolution
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(global.fetch).toHaveBeenCalled();
  });
});

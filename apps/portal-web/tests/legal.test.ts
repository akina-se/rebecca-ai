import { loadLegalContactEmail } from '../src/scripts/legal';

describe('Client Script - Legal Contact Email', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="contact-email-wrapper">
        <span id="contact-email-text" style="display:none;"></span>
        <span id="contact-email-note" style="display:none;"></span>
        <span id="contact-email-fallback">Fallback</span>
      </div>
    `;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should format and display contact email on successful plans fetch', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        plans: [],
        contactEmail: 'support@example.com',
      }),
    } as Response);

    await loadLegalContactEmail();

    const emailText = document.getElementById('contact-email-text');
    const emailNote = document.getElementById('contact-email-note');
    const emailFallback = document.getElementById('contact-email-fallback');

    expect(emailText?.textContent).toBe('support [at mark] example.com');
    expect(emailText?.style.display).toBe('inline');
    expect(emailNote?.style.display).toBe('block');
    expect(emailFallback?.style.display).toBe('none');
  });

  it('should retain fallback if response is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    await loadLegalContactEmail();

    const emailText = document.getElementById('contact-email-text');
    expect(emailText?.style.display).toBe('none');
  });

  it('should not update elements if contactEmail is missing in response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        plans: [],
        contactEmail: null,
      }),
    } as Response);

    await loadLegalContactEmail();

    const emailText = document.getElementById('contact-email-text');
    expect(emailText?.style.display).toBe('none');
  });

  it('should run DOMContentLoaded trigger cleanly', () => {
    document.dispatchEvent(new Event('DOMContentLoaded'));
  });

  it('should run safely even if DOM target elements are missing', async () => {
    document.body.innerHTML = '';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        plans: [],
        contactEmail: 'hello@example.com',
      }),
    } as Response);

    await expect(loadLegalContactEmail()).resolves.toBeUndefined();
  });

  it('should gracefully handle fetch rejection', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await loadLegalContactEmail();

    expect(warnSpy).toHaveBeenCalledWith('[Legal] Failed to load contact email:', expect.any(Error));
    warnSpy.mockRestore();
  });
});

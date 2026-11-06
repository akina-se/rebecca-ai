import { setLanguage } from '../src/scripts/main';

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

/**
 * Main application script for the public web portal.
 * Handles bilingual switching, navigation behaviors, and smooth UI transitions.
 */

declare global {
  interface Window {
    setLanguage: (lang: 'ja' | 'en') => void;
  }
}

/**
 * Updates the site-wide language state and switches button appearances.
 *
 * @param lang - Target language code ('ja' or 'en').
 */
export function setLanguage(lang: 'ja' | 'en'): void {
  document.body.setAttribute('data-lang', lang);
  document.documentElement.setAttribute('lang', lang);

  const btnJa = document.getElementById('btn-lang-ja');
  const btnEn = document.getElementById('btn-lang-en');

  if (btnJa && btnEn) {
    if (lang === 'ja') {
      btnJa.classList.add('active');
      btnEn.classList.remove('active');
    } else {
      btnEn.classList.add('active');
      btnJa.classList.remove('active');
    }
  }

  try {
    localStorage.setItem('portal_lang', lang);
  } catch {
    // LocalStorage might be disabled in sandboxed/incognito contexts
  }
}

// Expose setLanguage globally for inline button onclick handlers
if (typeof window !== 'undefined') {
  window.setLanguage = setLanguage;

  // Initialize language from saved preference or browser setting
  document.addEventListener('DOMContentLoaded', () => {
    let initialLang: 'ja' | 'en' = 'ja';
    try {
      const saved = localStorage.getItem('portal_lang');
      if (saved === 'en' || saved === 'ja') {
        initialLang = saved;
      }
    } catch {
      // Fallback to ja
    }
    setLanguage(initialLang);
  });
}

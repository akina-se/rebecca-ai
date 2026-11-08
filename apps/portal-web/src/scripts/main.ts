import { PublicSupportPlansResponse } from '@rebecca/types';

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

/**
 * Dynamically binds SSOT support plan links and prices to homepage landing tier cards.
 */
export async function initSupportPlanLinks(): Promise<void> {
  try {
    const res = await fetch('/api/v1/support/plans');
    if (!res.ok) return;
    const data: PublicSupportPlansResponse = await res.json();
    if (data.plans && Array.isArray(data.plans)) {
      for (const plan of data.plans) {
        const el = document.getElementById(`lp-tier-${plan.tier}`) as HTMLAnchorElement | null;
        if (!el) continue;
        const statusPill = el.querySelector('.tier-status-pill');
        const arrowIcon = el.querySelector('.tier-arrow-icon');
        if (plan.available && plan.paymentUrl) {
          el.href = plan.paymentUrl;
          el.target = '_blank';
          el.rel = 'noopener noreferrer';
          el.classList.remove('tier-disabled');
          el.removeAttribute('aria-disabled');
          if (statusPill) (statusPill as HTMLElement).style.display = 'none';
          if (arrowIcon) (arrowIcon as HTMLElement).style.display = 'inline-flex';
        } else {
          el.removeAttribute('href');
          el.classList.add('tier-disabled');
          el.setAttribute('aria-disabled', 'true');
          if (statusPill) (statusPill as HTMLElement).style.display = 'inline-flex';
          if (arrowIcon) (arrowIcon as HTMLElement).style.display = 'none';
        }
      }
    }
  } catch {
    // Graceful fallback to default disabled state
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
    const btnJa = document.getElementById('btn-lang-ja');
    const btnEn = document.getElementById('btn-lang-en');
    if (btnJa) {
      btnJa.addEventListener('click', () => setLanguage('ja'));
    }
    if (btnEn) {
      btnEn.addEventListener('click', () => setLanguage('en'));
    }
    initSupportPlanLinks().catch(() => {});
  });
}

import { PublicSupportPlansResponse } from '@rebecca/types';

/** Loads configured support contact email dynamically from backend */
export async function loadLegalContactEmail(): Promise<void> {
  try {
    const res = await fetch('/api/v1/support/plans');
    if (!res.ok) return;

    const data: PublicSupportPlansResponse = await res.json();
    if (data && data.contactEmail) {
      const emailText = document.getElementById('contact-email-text');
      const emailNote = document.getElementById('contact-email-note');
      const emailFallback = document.getElementById('contact-email-fallback');

      if (emailText) {
        const safeEmail = data.contactEmail.replace(/@/g, ' [at mark] ');
        emailText.textContent = safeEmail;
        emailText.style.display = 'inline';
      }
      if (emailNote) emailNote.style.display = 'block';
      if (emailFallback) emailFallback.style.display = 'none';
    }
  } catch (err) {
    console.warn('[Legal] Failed to load contact email:', err);
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    loadLegalContactEmail().catch(console.error);
  });
}

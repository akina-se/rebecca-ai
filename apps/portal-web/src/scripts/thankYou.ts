import { VerifySessionResponse } from '@rebecca/types';

/** Verifies session status on page load and handles download countdown timers */
export async function checkSessionVerification(): Promise<void> {
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session_id');

  // Scrub session_id from URL bar to prevent persistence in browser history
  if (sessionId && window.history && typeof window.history.replaceState === 'function') {
    urlParams.delete('session_id');
    const remaining = urlParams.toString();
    const cleanUrl = window.location.pathname + (remaining ? `?${remaining}` : '') + window.location.hash;
    window.history.replaceState(null, '', cleanUrl);
  }

  const rewardPanel = document.getElementById('reward-panel');
  const guidanceCard = document.getElementById('guidance-card');

  try {
    const headers: Record<string, string> = {};
    if (sessionId) {
      headers['x-stripe-session-id'] = sessionId;
    }

    const res = await fetch('/api/v1/support/verify-session', {
      method: 'GET',
      headers,
      credentials: 'same-origin',
    });

    if (!sessionId && !res.ok) {
      return;
    }

    const data: VerifySessionResponse = await res.json();
    if (res.ok && data.valid && rewardPanel && guidanceCard) {
      guidanceCard.style.display = 'none';
      rewardPanel.style.display = 'block';

      const isJa = document.body.getAttribute('data-lang') !== 'en';
      const nameDisplay = data.supporterName && data.supporterName.trim().length > 0
        ? data.supporterName
        : (isJa ? 'マスター' : 'Master');
      const nameEl = document.getElementById('supporter-name-display');
      const nameEnEl = document.getElementById('supporter-name-display-en');
      if (nameEl) nameEl.textContent = nameDisplay;
      if (nameEnEl) nameEnEl.textContent = nameDisplay;

      const badgePill = document.getElementById('tier-badge-pill');
      if (badgePill) {
        badgePill.className = `tier-badge-pill tier-badge-${data.tier ?? 'bronze'}`;
        badgePill.textContent = `${(data.tier ?? 'bronze').toUpperCase()} TIER`;
      }

      const itemDisplays = document.querySelectorAll('.item-label-display');
      itemDisplays.forEach((el) => {
        el.textContent = data.itemLabel && data.itemLabel.trim().length > 0
          ? data.itemLabel
          : (isJa ? '温かいご支援' : 'Contribution');
      });

      const dlBtn = document.getElementById('download-reward-btn') as HTMLAnchorElement | null;
      if (dlBtn && data.downloadUrl) {
        dlBtn.href = data.downloadUrl;
        dlBtn.classList.remove('disabled');
      }
    }
  } catch (err) {
    console.warn('[ThankYou] Session verification request failed:', err);
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    checkSessionVerification().catch(console.error);
  });
}

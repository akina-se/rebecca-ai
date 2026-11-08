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

      const trimmedSupporterName = data.supporterName !== null ? data.supporterName.trim() : '';
      const isFallback =
        trimmedSupporterName.length === 0 ||
        trimmedSupporterName === '名無しのマスター' ||
        trimmedSupporterName === 'Anonymous Master';
      const nameDisplayJa = isFallback ? 'マスター' : trimmedSupporterName;
      const nameDisplayEn = isFallback ? 'Master' : trimmedSupporterName;
      const nameEl = document.getElementById('supporter-name-display');
      const nameEnEl = document.getElementById('supporter-name-display-en');
      if (nameEl) nameEl.textContent = nameDisplayJa;
      if (nameEnEl) nameEnEl.textContent = nameDisplayEn;

      const badgePill = document.getElementById('tier-badge-pill');
      if (badgePill) {
        badgePill.className = `tier-badge-pill tier-badge-${data.tier}`;
        badgePill.textContent = `${data.tier.toUpperCase()} TIER`;
      }

      const ITEM_LABELS_EN: Record<string, string> = {
        bronze: 'Energy Drink',
        silver: 'Compute Resource',
        gold: 'Development Support',
      };
      const trimmedItemLabel = data.itemLabel.trim();
      document.querySelectorAll('.item-label-display-ja').forEach((el) => {
        el.textContent = trimmedItemLabel.length > 0 ? trimmedItemLabel : '温かいご支援';
      });
      document.querySelectorAll('.item-label-display-en').forEach((el) => {
        el.textContent = ITEM_LABELS_EN[data.tier] ?? (trimmedItemLabel.length > 0 ? trimmedItemLabel : 'Contribution');
      });
      document.querySelectorAll('.item-label-display:not(.item-label-display-ja):not(.item-label-display-en)').forEach((el) => {
        el.textContent = trimmedItemLabel.length > 0 ? trimmedItemLabel : '温かいご支援';
      });

      const img = document.getElementById('reward-image') as HTMLImageElement | null;
      if (img && data.reward !== null && data.reward.thumbnailUrl) {
        img.src = data.reward.thumbnailUrl;
        img.style.display = 'block';
      }

      const dlBtn = document.getElementById('download-reward-btn') as HTMLAnchorElement | null;
      if (dlBtn && !data.isExpired && data.reward !== null) {
        dlBtn.href = data.reward.downloadUrl;
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

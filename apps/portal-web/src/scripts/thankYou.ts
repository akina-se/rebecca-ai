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

  const loadingCard = document.getElementById('loading-card');
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

    if (loadingCard) {
      loadingCard.style.display = 'none';
    }

    if (!sessionId && !res.ok) {
      if (guidanceCard) {
        guidanceCard.style.display = 'block';
      }
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

      const assetContainer = document.getElementById('reward-asset-container');
      const img = document.getElementById('reward-image') as HTMLImageElement | null;
      const dlBtn = document.getElementById('download-reward-btn') as HTMLAnchorElement | null;
      const expiredPlaceholder = document.getElementById('reward-placeholder-expired');
      const errorPlaceholder = document.getElementById('reward-placeholder-error');
      const alertBox = document.querySelector<HTMLElement>('.dl-alert-box');
      const timerDisplay = document.getElementById('reward-expiry-timer');

      const showExpiredState = () => {
        if (img) img.style.display = 'none';
        if (errorPlaceholder) errorPlaceholder.style.display = 'none';
        if (expiredPlaceholder) expiredPlaceholder.style.display = 'flex';
        if (dlBtn) {
          dlBtn.classList.add('disabled');
          dlBtn.removeAttribute('href');
          dlBtn.removeAttribute('download');
          const jaSpan = dlBtn.querySelector('.t-ja');
          const enSpan = dlBtn.querySelector('.t-en');
          if (jaSpan) jaSpan.textContent = 'ダウンロード期限終了';
          if (enSpan) enSpan.textContent = 'Download Window Closed';
        }
        if (timerDisplay) timerDisplay.style.display = 'none';
        if (alertBox) alertBox.style.display = 'none';
        if (assetContainer) assetContainer.style.display = 'flex';
      };

      const showErrorState = () => {
        if (img) img.style.display = 'none';
        if (expiredPlaceholder) expiredPlaceholder.style.display = 'none';
        if (errorPlaceholder) errorPlaceholder.style.display = 'flex';
        if (assetContainer) assetContainer.style.display = 'flex';
      };

      if (data.isExpired || !data.reward) {
        showExpiredState();
      } else {
        const previewUrl = data.reward.thumbnailUrl;
        const downloadUrl = data.reward.downloadUrl;

        if (previewUrl || downloadUrl) {
          if (previewUrl && img) {
            img.onerror = () => {
              showErrorState();
            };
            img.src = previewUrl;
            img.style.display = 'block';
          }
          if (downloadUrl && dlBtn) {
            dlBtn.href = downloadUrl;
            dlBtn.classList.remove('disabled');
          }
          if (assetContainer) assetContainer.style.display = 'flex';
        }
      }
    } else if (guidanceCard) {
      guidanceCard.style.display = 'block';
      guidanceCard.innerHTML = `
        <div style="padding: 24px; color: #f87171; text-align: center;">
          <h3><span class="t-ja">セッション検証エラー</span><span class="t-en">Session Verification Error</span></h3>
          <p style="margin-top: 8px;">
            <span class="t-ja">セッションの検証に失敗したか、お支払いが完了していません。</span>
            <span class="t-en">Session verification failed or payment is incomplete.</span>
            <br>
            <a href="/supporters" class="btn btn-purple" style="margin-top: 16px;">
              <span class="t-ja">サポーターページへ</span><span class="t-en">Back to Supporters Page</span>
            </a>
          </p>
        </div>
      `.trim();
    }
  } catch (err) {
    if (loadingCard) {
      loadingCard.style.display = 'none';
    }
    if (guidanceCard) {
      guidanceCard.style.display = 'block';
    }
    console.warn('[ThankYou] Session verification request failed:', err);
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    checkSessionVerification().catch(console.error);
  });
}

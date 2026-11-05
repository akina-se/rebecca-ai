import { PublicSupporterCreditsResponse, PublicSupportPlansResponse } from '@rebecca/types';

const ROSTER_LIMIT = 120;

/** Sanitizes untrusted strings to prevent XSS in dynamic DOM insertions */
export function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/** Determines typography scaling class based on character count */
export function getNameFontClass(name?: string | null): string {
  const len = (name ?? '').length;
  if (len <= 8) return 'font-len-short';
  if (len <= 16) return 'font-len-medium';
  if (len <= 24) return 'font-len-long';
  return 'font-len-vlong';
}

/** Formats ISO datetime string to YYYY/MM/DD */
export function formatDateYMD(dateInput?: string | null): string {
  if (!dateInput) return '2026/10/25';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '2026/10/25';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

/** Loads active support plans from backend and attaches Stripe URLs to payment buttons */
export async function loadSupportPlans(): Promise<void> {
  try {
    const res = await fetch('/api/v1/support/plans');
    if (!res.ok) {
      throw new Error(`Failed to load plans: HTTP ${res.status}`);
    }
    const data: PublicSupportPlansResponse = await res.json();
    for (const plan of data.plans) {
      const btn = document.getElementById(`btn-plan-${plan.tier}`) as HTMLAnchorElement | null;
      if (btn && plan.paymentUrl) {
        btn.href = plan.paymentUrl;
        btn.classList.remove('disabled');
      }
    }
  } catch (err) {
    console.warn('[Supporters] Failed to load support plans:', err);
  }
}

/** Fetches paginated public supporter credits and updates the Hall of Fame roster */
export async function loadSupporterCredits(page = 1): Promise<void> {
  const grid = document.getElementById('roster-grid');
  const metaBadge = document.getElementById('roster-meta-badge');
  const pagination = document.getElementById('roster-pagination');
  if (!grid) return;

  grid.innerHTML = '<div class="roster-empty-state"><span class="t-ja">サポーター名簿を同期中...</span><span class="t-en">Loading supporter roster...</span></div>';

  try {
    const res = await fetch(`/api/v1/support/credits?page=${page}&limit=${ROSTER_LIMIT}`);
    if (!res.ok) {
      throw new Error(`Failed to load credits: HTTP ${res.status}`);
    }
    const data: PublicSupporterCreditsResponse = await res.json();
    const credits = data.credits ?? [];
    const total = data.total ?? credits.length;
    const totalPages = data.totalPages ?? (total > 0 ? Math.ceil(total / ROSTER_LIMIT) : 1);

    if (metaBadge) {
      const pageInfo = totalPages > 1 ? ` · P.${page}/${totalPages}` : '';
      metaBadge.innerHTML = `<span class="t-ja">${total}名のサポーター${pageInfo}</span><span class="t-en">${total} SUPPORTERS${pageInfo}</span>`;
    }

    if (credits.length === 0) {
      grid.innerHTML = '<div class="roster-empty-state"><span class="t-ja">まだサポーターが登録されていません。最初のサポーターになりませんか？</span><span class="t-en">No supporters recorded yet. Be the first supporter!</span></div>';
      if (pagination) pagination.innerHTML = '';
      return;
    }

    grid.innerHTML = '';
    for (const item of credits) {
      const tier = item.tier ?? 'bronze';
      const icon = tier === 'gold'
        ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>'
        : (tier === 'silver'
          ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>'
          : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>');

      const dateFormatted = formatDateYMD(item.createdAt);
      const displayName = item.safeName && item.safeName.trim().length > 0 ? item.safeName : 'Anonymous';
      const fontClass = getNameFontClass(displayName);

      const card = document.createElement('div');
      card.className = `roster-card tier-${tier}`;
      card.title = displayName;
      card.innerHTML = `
        <div class="roster-card-header">
          <div class="roster-card-header-left">
            <div class="roster-rank-icon">${icon}</div>
            <span class="roster-card-tier-tag">${tier.toUpperCase()}</span>
          </div>
          <span class="roster-card-date">${dateFormatted}</span>
        </div>
        <div class="roster-name-wrap">
          <div class="roster-name ${fontClass}">${escapeHtml(displayName)}</div>
        </div>
      `.trim();
      grid.appendChild(card);
    }
  } catch (err) {
    console.error('[Supporters] Failed to load supporter roster:', err);
    grid.innerHTML = '<div class="roster-empty-state"><span class="t-ja">名簿の取得に失敗しました</span><span class="t-en">Failed to load supporter roster</span></div>';
    if (pagination) pagination.innerHTML = '';
  }
}

// Auto-initialize when loaded on the supporters page
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    loadSupportPlans().catch(console.error);
    loadSupporterCredits(1).catch(console.error);
  });
}

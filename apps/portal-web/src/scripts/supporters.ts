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

const PLAN_ACTION_LABELS: Record<string, { ja: string; en: string }> = {
  bronze: { ja: 'エナドリを差し入れ', en: 'Send Energy Drink' },
  silver: { ja: 'サーバーリソースを差し入れ', en: 'Send Compute Resource' },
  gold: { ja: '開発サポートを送る', en: 'Support Development' },
};

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
      if (!btn) continue;
      const card = btn.closest('.tier-card');

      if (card && plan.amount) {
        const priceEl = card.querySelector('.tier-price');
        if (priceEl) {
          const slotSpan = priceEl.querySelector('span');
          const slotHtml = slotSpan ? slotSpan.outerHTML : '<span><span class="t-ja">/ 一口</span><span class="t-en">/ slot</span></span>';
          priceEl.innerHTML = `¥${plan.amount.toLocaleString()} ${slotHtml}`;
        }
      }

      if (plan.available && plan.paymentUrl) {
        btn.href = plan.paymentUrl;
        btn.target = '_blank';
        btn.rel = 'noopener noreferrer';
        btn.classList.remove('btn-disabled', 'disabled');
        btn.removeAttribute('aria-disabled');
        if (card) card.classList.remove('tier-disabled');

        const labels = PLAN_ACTION_LABELS[plan.tier];
        const formattedAmount = plan.amount ? `（¥${plan.amount.toLocaleString()}）` : '';
        const formattedAmountEn = plan.amount ? ` (¥${plan.amount.toLocaleString()})` : '';
        if (labels) {
          btn.innerHTML = `<span class="t-ja">${labels.ja}${formattedAmount}</span><span class="t-en">${labels.en}${formattedAmountEn}</span>`;
        }
      } else {
        btn.removeAttribute('href');
        btn.classList.add('btn-disabled', 'disabled');
        btn.setAttribute('aria-disabled', 'true');
        if (card) card.classList.add('tier-disabled');
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.6; flex-shrink: 0;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg><span class="t-ja">準備中（受付開始までお待ちください）</span><span class="t-en">Coming Soon</span>';
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
      if (page === 1) renderRecentSupporters([]);
      return;
    }

    if (page === 1) {
      renderRecentSupporters(credits.slice(0, 10));
    }

    grid.innerHTML = '';
    const ALLOWED_TIERS = new Set(['bronze', 'silver', 'gold', 'vip']);
    for (const item of credits) {
      const rawTier = typeof item.tier === 'string' ? item.tier.toLowerCase() : 'bronze';
      const tier = ALLOWED_TIERS.has(rawTier) ? rawTier : 'bronze';
      const icon = tier === 'gold'
        ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>'
        : (tier === 'silver'
          ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>'
          : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>');

      const dateFormatted = formatDateYMD(item.createdAt);
      const displayName = item.safeName && item.safeName.trim().length > 0 ? item.safeName : 'Anonymous Master';
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

/**
 * Renders the top recent supporters horizontal chip list.
 */
export function renderRecentSupporters(
  recentItems: Array<{ tier?: string; safeName?: string }>,
): void {
  const container = document.getElementById('recent-supporters-list');
  if (!container) return;

  if (!recentItems || recentItems.length === 0) {
    container.innerHTML = `
      <div class="recent-loading-placeholder">
        <span class="t-ja">まだ直近のご支援はありません</span>
        <span class="t-en">No recent supporters yet</span>
      </div>
    `.trim();
    return;
  }

  const ALLOWED_TIERS = new Set(['bronze', 'silver', 'gold', 'vip']);
  container.innerHTML = '';

  for (const item of recentItems) {
    const rawTier = typeof item.tier === 'string' ? item.tier.toLowerCase() : 'bronze';
    const tier = ALLOWED_TIERS.has(rawTier) ? rawTier : 'bronze';
    const icon =
      tier === 'gold'
        ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>'
        : tier === 'silver'
          ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>'
          : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>';

    const displayName = item.safeName && item.safeName.trim().length > 0 ? item.safeName : 'Anonymous Master';
    const chip = document.createElement('div');
    chip.className = `recent-chip tier-${tier}`;
    chip.title = displayName;
    chip.innerHTML = `
      <span class="recent-chip-icon">${icon}</span>
      <span class="recent-chip-name">${escapeHtml(displayName)}</span>
      <span class="recent-chip-badge">${tier.toUpperCase()}</span>
    `.trim();
    container.appendChild(chip);
  }
}

// Auto-initialize when loaded on the supporters page
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    loadSupportPlans().catch(console.error);
    loadSupporterCredits(1).catch(console.error);
    initTiersCarousel();
  });
}

/** Initializes the mobile carousel behavior and dot indicators for sponsorship tiers */
export function initTiersCarousel(): void {
  const grid = document.getElementById('tiers-grid') as HTMLElement | null;
  if (!grid) return;
  const targetGrid = grid;

  const edgeLeft = document.getElementById('tiers-edge-left') as HTMLElement | null;
  const edgeRight = document.getElementById('tiers-edge-right') as HTMLElement | null;
  const dots = document.querySelectorAll<HTMLElement>('#tiers-carousel-dots .carousel-dot');
  const cards = targetGrid.querySelectorAll<HTMLElement>('.tier-card');

  function updateEdgesAndDots(): void {
    if (typeof window === 'undefined' || window.innerWidth > 900) return;
    const scrollLeft = targetGrid.scrollLeft;
    const maxScroll = targetGrid.scrollWidth - targetGrid.clientWidth;

    if (edgeLeft) {
      if (scrollLeft > 15) {
        edgeLeft.classList.add('active');
      } else {
        edgeLeft.classList.remove('active');
      }
    }

    if (edgeRight) {
      if (scrollLeft < maxScroll - 15) {
        edgeRight.classList.add('active');
      } else {
        edgeRight.classList.remove('active');
      }
    }

    if (cards.length > 0 && dots.length > 0) {
      let closestIdx = 0;
      let minDiff = Infinity;
      const containerCenter = scrollLeft + targetGrid.clientWidth / 2;

      cards.forEach((card, idx) => {
        const cardCenter = card.offsetLeft + card.offsetWidth / 2;
        const diff = Math.abs(containerCenter - cardCenter);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = idx;
        }
      });

      dots.forEach((dot, idx) => {
        if (idx === closestIdx) {
          dot.classList.add('active');
        } else {
          dot.classList.remove('active');
        }
      });
    }
  }

  dots.forEach((dot) => {
    dot.addEventListener('click', () => {
      const idx = parseInt(dot.getAttribute('data-index') ?? '0', 10);
      if (cards[idx]) {
        cards[idx].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    });
  });

  targetGrid.addEventListener('scroll', updateEdgesAndDots, { passive: true });
  window.addEventListener('resize', updateEdgesAndDots, { passive: true });
  if (typeof window !== 'undefined' && window.innerWidth <= 900 && cards[1]) {
    const targetScroll = cards[1].offsetLeft - (targetGrid.clientWidth - cards[1].offsetWidth) / 2;
    targetGrid.scrollLeft = Math.max(0, targetScroll);
  }
  setTimeout(updateEdgesAndDots, 100);
}

import { AnniversaryItem, IAnniversaryProvider } from '../types';

/**
 * Timeout in milliseconds for Wikipedia API requests.
 */
const WIKIPEDIA_API_TIMEOUT_MS = 4000;

/**
 * Strips MediaWiki syntax artifacts to extract clean display text.
 * Handles wiki-links ([[Link|Text]] -> Text, [[Link]] -> Link),
 * templates ({{...}}), and citations (<ref>...</ref>).
 *
 * @param text - Raw wikitext string.
 * @returns Sanitized plain text string.
 */
export const sanitizeWikiText = (text: string): string => {
  let cleaned = text;
  while (cleaned.includes('<!--')) {
    const next = cleaned.replace(/<!--[\s\S]*?-->/g, '');
    if (next === cleaned) break;
    cleaned = next;
  }
  return cleaned
    .replace(/<ref[\s\S]*?<\/ref>/gi, '')
    .replace(/<ref[\s\S]*?\/>/gi, '')
    .replace(/{{(?:JPN|USA|GBR|FRA|GER|ITA|CAN|RUS|CHN|KOR|BRA|AUS|PAK|AND|MLT|MOZ|[A-Z]{3})}}/gi, '')
    .replace(/{{(?:仮リンク\|)?([^|}]+)(?:\|[^}]+)?}}/g, '$1')
    .replace(/{{[^}]+}}/g, '')
    .replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, '$1')
    .replace(/'''?/g, '')
    .replace(/\s+/g, ' ')
    .replace(/（\s*）|\(\s*\)/g, '')
    .trim();
};

/**
 * Parses Wikipedia "記念日・年中行事" section wikitext into structured AnniversaryItem records.
 *
 * @param sectionText - Wikitext of the target section.
 * @returns Array of parsed anniversary items.
 */
export const parseAnniversarySection = (sectionText: string): AnniversaryItem[] => {
  const lines = sectionText.split('\n');
  const items: AnniversaryItem[] = [];
  let currentItem: AnniversaryItem | null = null;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (trimmed.startsWith('* ') || trimmed.startsWith('*[[')) {
      if (currentItem) {
        items.push(currentItem);
        currentItem = null;
      }
      const rawContent = trimmed.replace(/^\*\s*/, '');
      const cleanName = sanitizeWikiText(rawContent);
      if (cleanName.length > 0) {
        currentItem = {
          name: cleanName,
          description: '',
        };
      }
    } else if (trimmed.startsWith('*:') && currentItem) {
      const descContent = trimmed.replace(/^\*:\s*/, '');
      const cleanDesc = sanitizeWikiText(descContent);
      if (cleanDesc.length > 0) {
        currentItem.description = currentItem.description
          ? `${currentItem.description} ${cleanDesc}`
          : cleanDesc;
      }
    }
  }

  if (currentItem) {
    items.push(currentItem);
  }

  return items;
};

/**
 * Provider that retrieves memorial days from Japanese Wikipedia's day pages (e.g., "9月8日").
 */
export class WikipediaAnniversaryProvider implements IAnniversaryProvider {
  /**
   * Fetches and parses anniversary items for the provided date from Japanese Wikipedia.
   * Uses a single HTTP request to fetch wikitext and extracts the memorial section.
   *
   * @param date - The date to fetch anniversaries for.
   * @returns List of parsed anniversary items, or an empty list upon error/timeout.
   */
  async getAnniversaries(date: Date): Promise<AnniversaryItem[]> {
    try {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const pageTitle = `${month}月${day}日`;
      const encodedTitle = encodeURIComponent(pageTitle);

      const url = `https://ja.wikipedia.org/w/api.php?action=parse&page=${encodedTitle}&prop=wikitext&format=json`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(WIKIPEDIA_API_TIMEOUT_MS),
        headers: {
          'User-Agent': 'RebeccaBot/1.0 (https://github.com/akina-se/rebecca-ai)',
        },
      });

      if (!response.ok) {
        console.warn(`[WikipediaAnniversaryProvider] Failed to fetch wikitext: HTTP ${response.status}`);
        return [];
      }

      const json = (await response.json()) as {
        parse?: {
          wikitext?: { '*': string };
        };
      };

      const fullWikitext = json.parse?.wikitext?.['*'];
      if (!fullWikitext) {
        return [];
      }

      // Locate the "記念日・年中行事" section within the wikitext
      const sectionMatch = fullWikitext.match(/==\s*(?:記念日|年中行事)[^\n]*\n([\s\S]*?)(?=\n==|$)/);
      if (!sectionMatch || !sectionMatch[1]) {
        console.warn(`[WikipediaAnniversaryProvider] No anniversary section found for ${pageTitle}`);
        return [];
      }

      return parseAnniversarySection(sectionMatch[1]);
    } catch (error) {
      console.warn('[WikipediaAnniversaryProvider] Error fetching anniversaries from Wikipedia:', error);
      return [];
    }
  }
}

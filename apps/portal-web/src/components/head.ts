import { PortalBrandConfig } from '@rebecca/types';

/** Options customizing head tags for specific pages */
export interface HeadOptions {
  title?: string;
  description?: string;
  ogpImage?: string;
  canonicalPath?: string;
}

/**
 * Generates the common HTML <head> contents including SEO, OGP, fonts, and theme variables.
 *
 * @param config - The active portal brand configuration.
 * @param options - Page-specific overrides.
 * @returns Serialized HTML string for <head>.
 */
export function renderHead(config: PortalBrandConfig, options: HeadOptions = {}): string {
  const pageTitle = options.title ? `${options.title} | ${config.displayName}` : `${config.displayName} (${config.englishName}) - Autonomous Personal AI | ${config.organizationName}`;
  const pageDescription = options.description ?? config.description;
  const canonicalUrl = `${config.canonicalUrl.replace(/\/$/, '')}${options.canonicalPath ?? ''}`;
  const ogpImage = options.ogpImage ?? `${config.canonicalUrl.replace(/\/$/, '')}/${config.assets.ogpBanner}`;

  return `
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle}</title>
  <meta name="title" content="${pageTitle}">
  <meta name="description" content="${pageDescription}">
  <link rel="icon" type="image/svg+xml" href="/${config.assets.faviconSvg}">
  <link rel="apple-touch-icon" href="/${config.assets.faviconPng}">

  <link rel="canonical" href="${canonicalUrl}">
  <link rel="sitemap" type="application/xml" title="Sitemap" href="${config.canonicalUrl.replace(/\/$/, '')}/sitemap.xml">

  <!-- Open Graph / Social Media Cards -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:title" content="${pageTitle}">
  <meta property="og:description" content="${pageDescription}">
  <meta property="og:image" content="${ogpImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${pageTitle}">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="${config.social.xHandle}">
  <meta name="twitter:creator" content="${config.social.xHandle}">
  <meta name="twitter:url" content="${canonicalUrl}">
  <meta name="twitter:title" content="${pageTitle}">
  <meta name="twitter:description" content="${pageDescription}">
  <meta name="twitter:image" content="${ogpImage}">

  <!-- Fonts & Design System -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Noto+Sans+JP:wght@300;400;500;700&display=swap">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Noto+Sans+JP:wght@300;400;500;700&display=swap" media="print" onload="this.media='all'">
  <noscript>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Noto+Sans+JP:wght@300;400;500;700&display=swap">
  </noscript>

  <link rel="stylesheet" href="/src/styles/theme.css">
  <link rel="stylesheet" href="/src/styles/base.css">
  <link rel="stylesheet" href="/src/styles/components.css">
  <link rel="stylesheet" href="/src/styles/layout.css">
`.trim();
}

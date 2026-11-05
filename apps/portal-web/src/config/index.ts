import { PortalBrandConfig } from '@rebecca/types';
import { REBECCA_PORTAL_CONFIG } from '@rebecca/persona';

/**
 * Active portal brand configuration.
 * By default, loads the Rebecca AI persona configuration.
 * Swapping or overriding this config switches the entire web portal branding.
 */
export const activePortalConfig: PortalBrandConfig = REBECCA_PORTAL_CONFIG;

/**
 * Resolves CSS variables declared from portal theme colors.
 *
 * @param config - The brand configuration.
 * @returns CSS snippet containing custom properties for :root.
 */
export function generateThemeCssVariables(config: PortalBrandConfig): string {
  const { theme } = config;
  return `
    :root {
      --color-primary: ${theme.primary};
      --color-primary-light: ${theme.primaryLight};
      --color-primary-glow: ${theme.primaryGlow};
      --color-secondary: ${theme.secondary};
      --color-accent: ${theme.accent};
      --color-bg: ${theme.background};
      --color-bg-card: ${theme.backgroundCard};
      --color-text-primary: ${theme.textPrimary};
      --color-text-secondary: ${theme.textSecondary};
    }
  `.trim();
}

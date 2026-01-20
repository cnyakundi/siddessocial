/**
 * Public site configuration used by static legal/policy pages.
 *
 * Set these in your hosting environment (e.g., Vercel):
 *   NEXT_PUBLIC_SUPPORT_EMAIL
 *   NEXT_PUBLIC_PRIVACY_EMAIL
 *   NEXT_PUBLIC_LEGAL_ENTITY_NAME
 *   NEXT_PUBLIC_LEGAL_JURISDICTION
 */

export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@YOURDOMAIN.com";
export const PRIVACY_EMAIL = process.env.NEXT_PUBLIC_PRIVACY_EMAIL || "privacy@YOURDOMAIN.com";
export const LEGAL_ENTITY_NAME = process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME || "YOUR LEGAL ENTITY NAME";
export const LEGAL_JURISDICTION = process.env.NEXT_PUBLIC_LEGAL_JURISDICTION || "YOUR JURISDICTION";

export const ACCOUNT_DELETION_REQUEST_PATH = "/account-deletion";

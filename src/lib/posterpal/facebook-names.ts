/**
 * Meta App Dashboard → Basic Settings display-name rules.
 * https://developers.facebook.com/documentation/development/create-an-app/app-dashboard/basic-settings
 *
 * This product can be called PosterPal. The Facebook App you register at
 * developers.facebook.com cannot — “Book” and “Face” are treated as Facebook
 * references.
 */
export const FB_APP_NAME_SUGGESTIONS = [
  "PageDesk",
  "ShoreDesk",
  "DeskPages",
  "PageOps",
  "WinonaDesk",
] as const;

const FORBIDDEN = [
  { re: /\bfacebook\b/i, why: "Cannot contain “Facebook”." },
  { re: /\bfb\b/i, why: "Cannot contain “FB”." },
  { re: /\bmeta\b/i, why: "Cannot contain “Meta”." },
  { re: /\binstagram\b|\binsta\b/i, why: "Cannot contain Instagram / Insta." },
  { re: /\bwhatsapp\b/i, why: "Cannot contain WhatsApp." },
  { re: /\boculus\b/i, why: "Cannot contain Oculus." },
  { re: /\bthreads\b/i, why: "Cannot contain Threads." },
  { re: /\bbook\b/i, why: "Cannot contain “Book” — Meta reads it as a Facebook reference. Use PageDesk, ShoreDesk, or DeskPages instead of PosterPal." },
  { re: /\bface\b/i, why: "Cannot contain “Face” if it could be read as Facebook." },
];

export function facebookAppNameIssues(name: string): string[] {
  const n = name.trim();
  const issues: string[] = [];
  if (!n) issues.push("Pick a Facebook App display name (this is not the PosterPal product name).");
  if (n.length > 32) issues.push("Keep it short — under 32 characters is safest for review.");
  for (const f of FORBIDDEN) {
    if (f.re.test(n)) issues.push(f.why);
  }
  return issues;
}

export function isAllowedFacebookAppName(name: string): boolean {
  return facebookAppNameIssues(name).length === 0;
}

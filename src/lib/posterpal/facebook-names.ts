/**
 * Meta App Dashboard → Basic Settings display-name rules.
 * https://developers.facebook.com/documentation/development/create-an-app/app-dashboard/basic-settings
 *
 * PosterPal is allowed as both this desk's name and the Facebook App display name.
 * Forbidden: Facebook, FB, Meta, Instagram, WhatsApp, and “Book” / “Face”
 * if they read as a Facebook reference (that is why BookBoss was rejected).
 */
export const FB_APP_NAME_SUGGESTIONS = [
  "PosterPal",
  "PageDesk",
  "ShoreDesk",
  "DeskPages",
  "WinonaDesk",
] as const;

const FORBIDDEN = [
  { re: /\bfacebook\b|\bfb/i, why: "Cannot contain “Facebook” or “FB”." },
  { re: /\bmeta\b/i, why: "Cannot contain “Meta”." },
  { re: /\binstagram|\binsta/i, why: "Cannot contain Instagram / Insta." },
  { re: /\bwhatsapp\b/i, why: "Cannot contain WhatsApp." },
  { re: /\boculus\b/i, why: "Cannot contain Oculus." },
  { re: /\bthreads\b/i, why: "Cannot contain Threads." },
  // Meta reads “Book” / “Face” at the START of a word as a Facebook reference —
  // that is why BookBoss was rejected even though `\bbook\b` never matched it.
  { re: /\bbook/i, why: "Cannot contain “Book” — Meta reads it as a Facebook reference (BookBoss was rejected). PosterPal is fine." },
  { re: /\bface/i, why: "Cannot contain “Face” if it could be read as Facebook." },
];

export function facebookAppNameIssues(name: string): string[] {
  const n = name.trim();
  const issues: string[] = [];
  if (!n) issues.push("Enter the display name you will type into the Facebook dashboard.");
  if (n.length > 32) issues.push("Keep it short — under 32 characters is safest for review.");
  for (const f of FORBIDDEN) {
    if (f.re.test(n)) issues.push(f.why);
  }
  return issues;
}

export function isAllowedFacebookAppName(name: string): boolean {
  return facebookAppNameIssues(name).length === 0;
}

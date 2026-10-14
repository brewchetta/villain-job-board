// Shared HTML shell for every styled email, so the hired email and the future
// newsletter get the same header and footer. It mirrors the site theme in
// src/app/globals.css (keep the colors in step with the :root variables there).
// Email clients ignore stylesheets and CSS variables, so this is table layout
// with inline styles and literal colors.
const COLORS = {
  background: "#0d1a11",
  surface: "#15281b",
  foreground: "#f3ead7",
  muted: "#b9c2a8",
  green: "#8bc34a",
  red: "#8b1020",
  redBright: "#b3162b",
  trim: "#f3ead7",
} as const;

// Creepster loads in clients that allow web fonts (Apple Mail, iOS Mail);
// the rest fall back to Impact.
const DISPLAY_FONT = "'Creepster', Impact, 'Arial Black', sans-serif";
const BODY_FONT = "Arial, Helvetica, sans-serif";

// The header logo is switched off for now because it did not render in the
// mail client (a localhost SITE_URL can't be loaded). Set to true once the site
// is deployed and SITE_URL is public.
const SHOW_LOGO = false;

// public/logo.png is 799x1080, shown 48px tall in the site nav.
const LOGO_HEIGHT = 48;
const LOGO_WIDTH = 36;

// User-supplied text (nicknames, job titles) goes into the HTML, so escape it.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Accepts the SITE_URL env var and returns a bare origin like
// "https://example.com", or undefined when it is missing or not http(s).
// Links and the logo need an absolute URL because mail clients have no site.
export function normalizeSiteUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

// Heading in the site's h1 style (green, display font).
export function heading(text: string): string {
  return `<div style="font-family:${DISPLAY_FONT};font-weight:400;font-size:40px;line-height:1.15;letter-spacing:0.03em;color:${COLORS.green};margin:0 0 16px;">${escapeHtml(text)}</div>`;
}

export function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-family:${BODY_FONT};font-size:16px;line-height:1.6;color:${COLORS.foreground};">${escapeHtml(text)}</p>`;
}

// The site's .card-list item: surface panel with a red left border.
export function card({ label, title, note }: { label: string; title: string; note?: string }): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;"><tr><td style="background:${COLORS.surface};border-left:6px solid ${COLORS.redBright};border-radius:6px;padding:16px 20px;">
<div style="font-family:${BODY_FONT};font-size:13px;color:${COLORS.muted};margin:0 0 4px;">${escapeHtml(label)}</div>
<div style="font-family:${DISPLAY_FONT};font-weight:400;font-size:26px;line-height:1.2;color:${COLORS.green};">${escapeHtml(title)}</div>${
    note
      ? `\n<div style="font-family:${BODY_FONT};font-size:14px;color:${COLORS.muted};margin-top:6px;">${escapeHtml(note)}</div>`
      : ""
  }
</td></tr></table>`;
}

// The site's a.button: red pill with a cream border.
export function button({ label, href }: { label: string; href: string }): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;"><tr><td style="background:${COLORS.red};border:2px solid ${COLORS.trim};border-radius:999px;">
<a href="${escapeHtml(href)}" style="display:inline-block;padding:10px 24px;font-family:${BODY_FONT};font-size:16px;font-weight:700;color:${COLORS.foreground};text-decoration:none;">${escapeHtml(label)}</a>
</td></tr></table>`;
}

export function emailLayout({
  title,
  body,
  footer,
  siteUrl,
}: {
  title: string;
  body: string;
  footer: string;
  siteUrl?: string;
}): string {
  const logo = SHOW_LOGO && siteUrl
    ? `<td style="padding-right:12px;"><img src="${escapeHtml(siteUrl)}/logo.png" alt="" width="${LOGO_WIDTH}" height="${LOGO_HEIGHT}" style="display:block;width:${LOGO_WIDTH}px;height:${LOGO_HEIGHT}px;border:0;"></td>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Creepster&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${COLORS.background};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.background};"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${COLORS.background};">
<tr><td style="background:${COLORS.red};border-bottom:6px solid ${COLORS.trim};padding:10px 24px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>${logo}<td style="font-family:${DISPLAY_FONT};font-weight:400;font-size:28px;letter-spacing:0.04em;color:${COLORS.foreground};">The Garden</td></tr></table>
</td></tr>
<tr><td style="padding:32px 24px 8px;">
${body}
</td></tr>
<tr><td style="padding:16px 24px;border-top:3px solid ${COLORS.redBright};font-family:${BODY_FONT};font-size:13px;line-height:1.5;color:${COLORS.muted};">
${escapeHtml(footer)}
</td></tr>
</table>
</td></tr></table>
</body>
</html>`;
}

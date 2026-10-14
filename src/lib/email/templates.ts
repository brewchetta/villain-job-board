import { button, card, emailLayout, heading, paragraph } from "./layout";

// Email content lives here as pure functions so it is easy to test and so the
// monthly newsletter can add its own template beside these. Each template
// returns a plain-text version (always sent, as the fallback) and a styled
// HTML version built from the shared layout in ./layout.
export type EmailContent = {
  subject: string;
  text: string;
  html?: string;
};

type NameParts = {
  evil_nickname: string | null;
  first_name: string | null;
  display_name: string | null;
};

const FALLBACK_NAME = "Henchman";

// Prefers the villain nickname, then real names, so the greeting matches how
// the candidate chose to present themselves.
export function greetingName(profile: NameParts | null): string {
  const name =
    profile?.evil_nickname?.trim() ||
    profile?.first_name?.trim() ||
    profile?.display_name?.trim();
  return name || FALLBACK_NAME;
}

// siteUrl is the site's origin (see normalizeSiteUrl). Without it the email
// still works but has no logo and no link, since mail clients need absolute URLs.
export function hiredEmail({
  name,
  jobTitle,
  siteUrl,
}: {
  name: string;
  jobTitle: string;
  siteUrl?: string;
}): EmailContent {
  const subject = `You're hired, ${name}`;
  const accountUrl = siteUrl ? `${siteUrl}/account` : undefined;

  const text = [
    `Congratulations, ${name}.`,
    "",
    `Your application for ${jobTitle} has been received, and we have decided not to waste time on interviews. You're hired.`,
    "",
    "Expect further instructions from your handler. Until then, keep your lair tidy and your plans secret.",
    ...(accountUrl ? ["", `View your application: ${accountUrl}`] : []),
    "",
    "Welcome to The Garden. This is an automated message, so please do not reply.",
  ].join("\n");

  const html = emailLayout({
    title: subject,
    siteUrl,
    footer: "Welcome to The Garden. This is an automated message, so please do not reply.",
    body: [
      heading(subject),
      paragraph(
        "Congratulations. Your application has been received, and we have decided not to waste time on interviews.",
      ),
      card({ label: "Your new position", title: jobTitle, note: "Status: hired on the spot" }),
      paragraph(
        "Expect further instructions from your handler. Until then, keep your lair tidy and your plans secret.",
      ),
      accountUrl ? button({ label: "View your application", href: accountUrl }) : "",
    ].join("\n"),
  });

  return { subject, text, html };
}

// One month's worth of newsletter content. The template below never changes;
// a different month just passes a different issue.
export type NewsletterIssue = {
  headline: string;
  intro: string;
  quote: string;
  prompt: string;
};

export const NEWSLETTER_SUBJECT = "What does evil mean to you?";

export const defaultIssue: NewsletterIssue = {
  headline: "What does evil mean to you?",
  intro:
    "Every great scheme begins with a question. Before the lair, the laser and the monologue, there is the quiet moment where you decide what you actually stand for. This month, we invite you to find your answer.",
  quote: "Evil is just ambition that stopped asking for permission.",
  prompt:
    "Take ten quiet minutes this month and write down what evil means to you. Then ask yourself one thing: what will you do about it?",
};

// siteUrl is the site's origin (see normalizeSiteUrl); without it there is no
// logo and no button, as with hiredEmail.
export function newsletterEmail({
  issue = defaultIssue,
  siteUrl,
}: {
  issue?: NewsletterIssue;
  siteUrl?: string;
} = {}): EmailContent {
  const subject = NEWSLETTER_SUBJECT;
  const jobsUrl = siteUrl ? `${siteUrl}/jobs` : undefined;
  const footer =
    "You are receiving this because you are part of The Garden job board. This is an automated message, so please do not reply.";

  const text = [
    issue.headline,
    "",
    issue.intro,
    "",
    `"${issue.quote}"`,
    "",
    issue.prompt,
    ...(jobsUrl ? ["", `Browse open positions: ${jobsUrl}`] : []),
    "",
    footer,
  ].join("\n");

  const html = emailLayout({
    title: subject,
    siteUrl,
    footer,
    body: [
      heading(issue.headline),
      paragraph(issue.intro),
      card({ label: "Words to scheme by", title: issue.quote }),
      paragraph(issue.prompt),
      jobsUrl ? button({ label: "Browse open positions", href: jobsUrl }) : "",
    ].join("\n"),
  });

  return { subject, text, html };
}

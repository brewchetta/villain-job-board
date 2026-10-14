// Email content lives here as pure functions so it is easy to test and so the
// monthly newsletter can add its own template beside these. `html` is optional:
// emails are plain text for now, and a styled version can be added per template
// later without touching the sender.
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

export function hiredEmail({
  name,
  jobTitle,
}: {
  name: string;
  jobTitle: string;
}): EmailContent {
  return {
    subject: `You're hired, ${name}`,
    text: [
      `Congratulations, ${name}.`,
      "",
      `Your application for ${jobTitle} has been received, and we have decided not to waste time on interviews. You're hired.`,
      "",
      "Expect further instructions from your handler. Do not reply to this email.",
      "",
      "Welcome to The Garden.",
    ].join("\n"),
  };
}

import "server-only";
import { sendEmail } from "./client";
import { normalizeSiteUrl } from "./layout";
import { newsletterEmail } from "./templates";

// While the newsletter is being tested it goes to one address only, taken from
// NEWSLETTER_TEST_RECIPIENT. Unset means nobody is emailed. There is no
// subscriber query yet, so a real user cannot receive it by accident. The real
// send replaces this function (see "Monthly newsletter" in CLAUDE.md).
export function getNewsletterRecipients(): string[] {
  const recipient = process.env.NEWSLETTER_TEST_RECIPIENT?.trim();
  return recipient ? [recipient] : [];
}

// Sends this month's newsletter to every recipient. sendEmail never throws, so
// a failed send is counted instead of aborting the rest.
export async function sendNewsletter(): Promise<{ sent: number; failed: number }> {
  const recipients = getNewsletterRecipients();
  if (recipients.length === 0) {
    console.error("Newsletter not sent: NEWSLETTER_TEST_RECIPIENT is not set.");
    return { sent: 0, failed: 0 };
  }

  const email = newsletterEmail({ siteUrl: normalizeSiteUrl(process.env.SITE_URL) });
  let sent = 0;
  let failed = 0;
  for (const to of recipients) {
    const result = await sendEmail({ to, ...email });
    if (result.ok) sent += 1;
    else failed += 1;
  }
  return { sent, failed };
}

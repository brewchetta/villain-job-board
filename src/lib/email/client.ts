import "server-only";
import { Resend } from "resend";
import type { EmailContent } from "./templates";

// Resend's shared sandbox sender. It only delivers to the Resend account
// owner's own address, which is enough until we verify a domain.
const DEFAULT_FROM = "The Garden <onboarding@resend.dev>";

export type SendEmailResult = { ok: true } | { ok: false };

// The only way the app sends email. It never throws: a failed email must not
// break the action that triggered it. Errors are logged by name only, because
// the full error can echo the recipient address.
export async function sendEmail({
  to,
  subject,
  text,
  html,
}: EmailContent & { to: string }): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("Email not sent: RESEND_API_KEY is not set.");
    return { ok: false };
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || DEFAULT_FROM,
      to,
      subject,
      text,
      ...(html ? { html } : {}),
    });
    if (error) {
      console.error("Email not sent: provider error", error.name);
      return { ok: false };
    }
    return { ok: true };
  } catch {
    console.error("Email not sent: request to provider failed.");
    return { ok: false };
  }
}

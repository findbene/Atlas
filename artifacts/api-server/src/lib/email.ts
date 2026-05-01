// Resend transactional email integration via Replit connector.
// Gracefully no-ops if the connector isn't configured so dev never breaks.
import { Resend } from "resend";
import { logger } from "./logger";

type ResendCreds = { apiKey: string; fromEmail: string };

let cachedCredsPromise: Promise<ResendCreds | null> | null = null;

async function fetchCredsFromConnector(): Promise<ResendCreds | null> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  if (!hostname) return null;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;
  if (!xReplitToken) return null;

  try {
    const res = await fetch(
      `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=resend`,
      { headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { items?: Array<{ settings?: { api_key?: string; from_email?: string } }> };
    const item = data.items?.[0];
    const apiKey = item?.settings?.api_key;
    const fromEmail = item?.settings?.from_email;
    if (!apiKey || !fromEmail) return null;
    // Resend rejects free-email domains (gmail / yahoo / outlook / icloud / hotmail)
    // as the sender — they can't be domain-verified. Fall back to Resend's
    // sandbox sender so dev works out of the box. Production should configure
    // a verified domain (e.g. mail.atlasprojects.dev) in the Resend connection.
    const domain = fromEmail.split("@")[1]?.toLowerCase() ?? "";
    const blocked = new Set(["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "aol.com", "live.com", "me.com"]);
    if (blocked.has(domain)) {
      logger.warn({ configured: fromEmail }, "Resend from_email uses an unverifiable free-email domain; falling back to onboarding@resend.dev. Configure a verified domain in the Resend integration for production.");
      return { apiKey, fromEmail: "Atlas <onboarding@resend.dev>" };
    }
    return { apiKey, fromEmail };
  } catch (err) {
    logger.warn({ err }, "Failed to fetch Resend connector credentials");
    return null;
  }
}

async function getCreds(): Promise<ResendCreds | null> {
  if (!cachedCredsPromise) cachedCredsPromise = fetchCredsFromConnector();
  const creds = await cachedCredsPromise;
  // If a fetch failed, allow a retry on the next call rather than caching failure forever.
  if (!creds) cachedCredsPromise = null;
  return creds;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  delivered: boolean;
  reason?: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const creds = await getCreds();
  if (!creds) {
    logger.warn({ to: opts.to, subject: opts.subject }, "Email skipped: Resend not configured");
    return { delivered: false, reason: "not_configured" };
  }
  try {
    const resend = new Resend(creds.apiKey);
    const result = await resend.emails.send({
      from: creds.fromEmail,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    if (result.error) {
      logger.error({ err: result.error, to: opts.to }, "Resend reported send error");
      return { delivered: false, reason: result.error.message };
    }
    return { delivered: true };
  } catch (err) {
    logger.error({ err, to: opts.to }, "Failed to send email via Resend");
    return { delivered: false, reason: "send_failed" };
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderWaitlistConfirmationEmail(opts: {
  email: string;
  domainInterest?: string | null;
}): { subject: string; html: string; text: string } {
  // Sanitize untrusted user-supplied input: only allow safe slug chars,
  // then HTML-escape before interpolating into the email body.
  const rawInterest = (opts.domainInterest ?? "").replace(/[^a-zA-Z0-9 _-]/g, "").slice(0, 80);
  const interestText = rawInterest ? ` for ${rawInterest.replace(/-/g, " ")}` : "";
  const interestHtml = rawInterest ? ` for <strong>${escapeHtml(rawInterest.replace(/-/g, " "))}</strong>` : "";
  const subject = `You're on the Atlas waitlist`;
  const text = [
    `Welcome to Atlas!`,
    ``,
    `You're on the waitlist${interestText}. We'll email you the moment new curriculum opens up.`,
    ``,
    `In the meantime, our Data Engineering track is fully live — start building real projects today: https://atlasprojects.dev`,
    ``,
    `— The Atlas team`,
  ].join("\n");
  const html = `<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.6;color:#1f2937;max-width:560px;margin:0 auto;padding:24px">
  <h1 style="font-size:22px;margin:0 0 16px">Welcome to Atlas</h1>
  <p style="font-size:15px">You're on the waitlist${interestHtml}. We'll email you the moment that curriculum opens up.</p>
  <p style="font-size:15px">In the meantime, our <strong>Data Engineering</strong> track is fully live — real, hands-on projects with an AI tutor at your side.</p>
  <p style="margin:24px 0">
    <a href="https://atlasprojects.dev" style="background:#2563eb;color:white;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600">Start building free</a>
  </p>
  <p style="font-size:13px;color:#6b7280">— The Atlas team</p>
</body></html>`;
  return { subject, html, text };
}

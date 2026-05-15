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

export function renderProjectCompletionEmail(opts: {
  userName?: string | null;
  projectTitle: string;
  projectSlug?: string | null;
  jobOutcomes?: {
    roles?: string[];
    skillsForResume?: string[];
    resumeBullets?: string[];
  } | null;
  appUrl?: string;
}): { subject: string; html: string; text: string } {
  const appUrl = opts.appUrl ?? "https://atlasprojects.dev";
  const safeName = opts.userName ? opts.userName.replace(/[\r\n]/g, " ").slice(0, 80) : "";
  const greetingText = safeName ? `Nice work, ${safeName}!` : `Nice work!`;
  const greetingHtml = safeName ? `Nice work, ${escapeHtml(safeName)}!` : `Nice work!`;
  const safeTitle = opts.projectTitle.replace(/[\r\n]/g, " ").slice(0, 200);
  const subject = `🎉 Career impact: you completed ${safeTitle}`;
  const roles = opts.jobOutcomes?.roles ?? [];
  const skills = opts.jobOutcomes?.skillsForResume ?? [];
  const bullets = opts.jobOutcomes?.resumeBullets ?? [];

  const dedupedRoles = Array.from(new Set(roles));
  const dedupedSkills = Array.from(new Set(skills));

  const profileUrl = `${appUrl}/profile`;
  const certsUrl = `${appUrl}/certificates`;
  const projectUrl = opts.projectSlug
    ? `${appUrl}/projects/${encodeURIComponent(opts.projectSlug)}`
    : appUrl;

  const rolesHtml = dedupedRoles.length
    ? `<p style="font-size:14px;margin:0 0 8px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;font-weight:600">Roles you're now portfolio-ready for</p>
       <p style="margin:0 0 20px">${dedupedRoles.map(r => `<span style="display:inline-block;background:#fef3c7;color:#92400e;border:1px solid #fcd34d;border-radius:9999px;padding:4px 12px;margin:0 6px 6px 0;font-size:13px;font-weight:600">${escapeHtml(r)}</span>`).join("")}</p>`
    : "";

  const skillsHtml = dedupedSkills.length
    ? `<p style="font-size:14px;margin:0 0 8px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;font-weight:600">Skills for your resume</p>
       <p style="margin:0 0 20px">${dedupedSkills.slice(0, 12).map(s => `<span style="display:inline-block;background:#f3f4f6;color:#374151;border:1px solid #e5e7eb;border-radius:6px;padding:3px 10px;margin:0 6px 6px 0;font-size:13px">${escapeHtml(s)}</span>`).join("")}</p>`
    : "";

  const bulletsHtml = bullets.length
    ? `<p style="font-size:14px;margin:0 0 10px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;font-weight:600">Resume bullets you can write today</p>
       <ul style="margin:0 0 20px;padding-left:0;list-style:none">${bullets.slice(0, 5).map(b => `<li style="border-left:3px solid #10b981;padding:6px 0 6px 12px;margin:0 0 8px;font-size:14px;color:#1f2937">${escapeHtml(b)}</li>`).join("")}</ul>`
    : "";

  const text = [
    greetingText,
    ``,
    `You completed "${safeTitle}" on Atlas. That's a real, shippable project on your portfolio.`,
    ``,
    dedupedRoles.length ? `Roles you're now portfolio-ready for: ${dedupedRoles.join(", ")}` : "",
    dedupedSkills.length ? `Skills for your resume: ${dedupedSkills.slice(0, 12).join(", ")}` : "",
    bullets.length ? `\nResume bullets:\n${bullets.slice(0, 5).map(b => `• ${b}`).join("\n")}` : "",
    ``,
    `View your career-impact summary: ${profileUrl}`,
    `Get your certificate: ${certsUrl}`,
    ``,
    `— The Atlas team`,
  ].filter(Boolean).join("\n");

  const html = `<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.55;color:#1f2937;max-width:600px;margin:0 auto;padding:24px;background:#fafafa">
  <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:32px">
    <p style="font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#92400e;font-weight:700;margin:0 0 8px">🎉 Project complete</p>
    <h1 style="font-size:24px;margin:0 0 8px;line-height:1.2">${greetingHtml}</h1>
    <p style="font-size:16px;margin:0 0 24px;color:#374151">You finished <strong>${escapeHtml(safeTitle)}</strong> — that's a real, shippable project on your portfolio.</p>
    ${rolesHtml}
    ${skillsHtml}
    ${bulletsHtml}
    <div style="margin:28px 0 8px">
      <a href="${profileUrl}" style="background:#2563eb;color:white;padding:11px 20px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;margin-right:8px">View career impact</a>
      <a href="${certsUrl}" style="background:white;color:#2563eb;border:1px solid #2563eb;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">Get your certificate</a>
    </div>
    <p style="font-size:13px;color:#6b7280;margin:24px 0 0">Keep building — <a href="${projectUrl}" style="color:#2563eb">pick your next project</a>.</p>
  </div>
  <p style="font-size:12px;color:#9ca3af;text-align:center;margin:16px 0 0">— The Atlas team</p>
</body></html>`;

  return { subject, html, text };
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

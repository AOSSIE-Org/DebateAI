import { env } from "./env";

/**
 * Transactional email — replaces `utils/email.go` (net/smtp). Workers cannot
 * open raw SMTP sockets, so this goes over HTTPS. Pick a provider with
 * EMAIL_PROVIDER:
 *   - "resend"       -> Resend HTTP API (needs RESEND_API_KEY)
 *   - "mailchannels" -> MailChannels (needs a verified domain + DNS records)
 *   - "console"      -> log only, for local dev
 */
type Mail = { to: string; subject: string; html: string };

async function sendResend(m: Mail) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env().RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ from: env().EMAIL_FROM, ...m }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

async function sendMailChannels(m: Mail) {
  const res = await fetch("https://api.mailchannels.net/tx/v1/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: m.to }] }],
      from: parseFrom(env().EMAIL_FROM),
      subject: m.subject,
      content: [{ type: "text/html", value: m.html }],
    }),
  });
  if (!res.ok) throw new Error(`MailChannels ${res.status}: ${await res.text()}`);
}

function parseFrom(s: string) {
  const m = s.match(/^(.*?)\s*<(.+?)>$/);
  return m ? { name: m[1], email: m[2] } : { email: s };
}

export async function sendEmail(m: Mail): Promise<void> {
  switch (env().EMAIL_PROVIDER) {
    case "resend":
      return sendResend(m);
    case "mailchannels":
      return sendMailChannels(m);
    default:
      console.log("[email:console]", m.to, "|", m.subject, "\n", m.html);
  }
}

export function sendVerificationEmail(to: string, code: string) {
  return sendEmail({
    to,
    subject: "Verify Your DebateAI Account",
    html: `<h2>Welcome to DebateAI!</h2><p>Your verification code is: <strong>${code}</strong></p><p><em>This code will expire in 24 hours.</em></p>`,
  });
}

export function sendPasswordResetEmail(to: string, code: string) {
  return sendEmail({
    to,
    subject: "DebateAI Password Reset",
    html: `<p>Your password reset code is: <strong>${code}</strong></p>`,
  });
}

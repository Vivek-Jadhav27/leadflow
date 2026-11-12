import nodemailer, { type Transporter } from 'nodemailer';

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailDeliveryResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: 'smtp' | 'resend' | 'console-dev';
}

function sanitizeSmtpUser(raw?: string): string {
  if (!raw) return '';
  let str = raw.trim();
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1).trim();
  }
  const match = str.match(/<([^>]+)>/);
  if (match) return match[1].trim();
  return str;
}

function sanitizeSmtpPass(raw?: string): string {
  if (!raw) return '';
  let str = raw.trim();
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1).trim();
  }
  return str.replace(/\s+/g, '');
}

class EmailService {
  private transporter: Transporter | null = null;
  private defaultFrom = process.env.EMAIL_FROM || 'LeadFlow <noreply@leadflow.io>';

  constructor() {
    this.initTransporter();
  }

  private initTransporter() {
    const host = process.env.SMTP_HOST?.trim();
    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    const user = sanitizeSmtpUser(process.env.SMTP_USER);
    const pass = sanitizeSmtpPass(process.env.SMTP_PASS);

    if (host && user && pass) {
      if (host.includes('gmail')) {
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user, pass },
        });
      } else {
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure: process.env.SMTP_SECURE === 'true' || port === 465,
          auth: { user, pass },
        });
      }
    }
  }

  /**
   * Sends an invitation email to an SDR.
   */
  async sendInvitationEmail(
    to: string,
    companyName: string,
    invitationLink: string
  ): Promise<EmailDeliveryResult> {
    const subject = `You've been invited to join ${companyName.replace(/[\r\n]+/g, ' ')} on LeadFlow.`;
    const safeCompany = companyName
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    const text = `Hi,

You've been invited to join ${companyName} on LeadFlow as an SDR.

LeadFlow helps your team manage leads, outreach sequences and sales activities in one place.

Accept your invitation using the link below:

${invitationLink}

This invitation expires in 48 hours.

If you weren't expecting this invitation, you can ignore this email.

Thanks,
LeadFlow Team`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invitation to join ${safeCompany} on LeadFlow</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f5f8fa; margin: 0; padding: 24px; color: #33475b;">
  <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #dfe3eb; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    <div style="display: flex; align-items: center; margin-bottom: 24px;">
      <div style="background-color: #ff7a59; color: white; width: 36px; height: 36px; border-radius: 6px; font-weight: bold; font-size: 18px; line-height: 36px; text-align: center;">L</div>
      <span style="margin-left: 10px; font-size: 18px; font-weight: bold; color: #2d3e50;">LeadFlow</span>
    </div>

    <h2 style="font-size: 20px; font-weight: bold; color: #2d3e50; margin-top: 0; margin-bottom: 16px;">
      Join ${safeCompany} on LeadFlow
    </h2>

    <p style="font-size: 14px; line-height: 1.6; color: #516f90; margin-bottom: 16px;">
      Hi,
    </p>

    <p style="font-size: 14px; line-height: 1.6; color: #516f90; margin-bottom: 16px;">
      You've been invited to join <strong>${safeCompany}</strong> on LeadFlow as an SDR.
    </p>

    <p style="font-size: 14px; line-height: 1.6; color: #516f90; margin-bottom: 24px;">
      LeadFlow helps your team manage leads, outreach sequences and sales activities in one place.
    </p>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${invitationLink}" style="background-color: #ff7a59; color: #ffffff; text-decoration: none; padding: 12px 24px; font-weight: 600; font-size: 14px; border-radius: 6px; display: inline-block;">
        Accept Invitation
      </a>
    </div>

    <p style="font-size: 13px; line-height: 1.5; color: #7c98b6; margin-bottom: 8px;">
      Or copy and paste this URL into your browser:
    </p>
    <p style="font-size: 12px; line-height: 1.4; color: #0091ae; word-break: break-all; margin-bottom: 24px;">
      ${invitationLink}
    </p>

    <p style="font-size: 12px; color: #99acc2; margin-bottom: 20px;">
      This invitation expires in 48 hours. If you weren't expecting this invitation, you can safely ignore this email.
    </p>

    <hr style="border: none; border-top: 1px solid #edf1f5; margin: 24px 0;" />

    <p style="font-size: 12px; color: #99acc2; margin: 0;">
      Thanks,<br><strong>LeadFlow Team</strong>
    </p>
  </div>
</body>
</html>`;

    return this.sendMail({ to, subject, text, html });
  }

  /**
   * Generic sender with support for SMTP, Resend API, and dev fallback.
   */
  async sendMail(options: SendEmailOptions): Promise<EmailDeliveryResult> {
    const { to, subject, text, html } = options;

    // 1. If Resend API key is present, attempt delivery via Resend HTTP API
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: this.defaultFrom,
            to: [to],
            subject,
            text,
            html,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          return {
            success: true,
            messageId: data.id,
            provider: 'resend',
          };
        } else {
          const errData = await response.text();
          console.error('[EmailService] Resend API error:', errData);
          return {
            success: false,
            error: `Resend error: ${errData}`,
            provider: 'resend',
          };
        }
      } catch (err) {
        console.error('[EmailService] Resend network error:', err);
        return {
          success: false,
          error: (err as Error).message,
          provider: 'resend',
        };
      }
    }

    // 2. If SMTP transporter is configured, send via SMTP
    if (this.transporter) {
      try {
        const fromAddress =
          process.env.SMTP_USER && process.env.SMTP_HOST?.includes('gmail')
            ? `LeadFlow <${process.env.SMTP_USER}>`
            : this.defaultFrom;

        const info = await this.transporter.sendMail({
          from: fromAddress,
          to,
          subject,
          text,
          html,
        });

        return {
          success: true,
          messageId: info.messageId,
          provider: 'smtp',
        };
      } catch (err) {
        console.error('[EmailService] SMTP error:', err);
        return {
          success: false,
          error: (err as Error).message,
          provider: 'smtp',
        };
      }
    }

    // 3. Fallback for development/testing when no external provider is yet configured
    console.info(`\n========================================\n[LeadFlow Transactional Email (DEV)]\nTo: ${to}\nSubject: ${subject}\n\n${text}\n========================================\n`);
    return {
      success: true,
      messageId: `dev_${Date.now()}`,
      provider: 'console-dev',
    };
  }
}

export const emailService = new EmailService();

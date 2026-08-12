import sgMail from "@sendgrid/mail";

import { env } from "../config/env";
import { logger } from "./logger";

/**
 * Gerçek e-posta gönderimi — SendGrid varsa onu kullanır, YOKSA (yerel
 * geliştirmede SENDGRID_API_KEY/EMAIL_FROM boşsa) sessizce `logger.info`
 * fallback'ine döner. Bu sayede yerel geliştirme gerçek bir SendGrid
 * hesabı GEREKTİRMEZ — `auth.service.ts`'in eski davranışı (linki sunucu
 * logunda göstermek) korunur, sadece artık YAPILANDIRILDIĞINDA gerçekten de
 * gönderir.
 */

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

const isConfigured = Boolean(env.SENDGRID_API_KEY && env.EMAIL_FROM);

if (isConfigured) {
  sgMail.setApiKey(env.SENDGRID_API_KEY!);
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  if (!isConfigured) {
    logger.info("E-posta gönderilmedi (SendGrid yapılandırılmamış) — içerik logda", {
      to: input.to,
      subject: input.subject,
    });
    return;
  }

  try {
    await sgMail.send({
      to: input.to,
      from: env.EMAIL_FROM!,
      subject: input.subject,
      html: input.html,
    });
  } catch (error) {
    // E-posta gönderimi BAŞARISIZ olsa bile isteği ÇÖKERTMEMELİ — ör. şifre
    // sıfırlama akışı hâlâ token üretmiş/kaydetmiştir, kullanıcı linki
    // destek üzerinden alabilir. Sadece logla.
    logger.error("E-posta gönderilemedi", {
      to: input.to,
      subject: input.subject,
      error,
    });
  }
}

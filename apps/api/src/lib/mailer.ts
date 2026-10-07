import nodemailer from 'nodemailer';
import { env, isTest } from '../env';
import { logger } from './logger';

type Mail = { to: string; subject: string; text: string };

/** Mails sent while NODE_ENV=test, for assertions. */
export const testOutbox: Mail[] = [];

const transport = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    })
  : null;

/**
 * Sends after the database commit. A delivery failure is logged and reported
 * to the caller, never rolled back: the person can always resend.
 */
async function send(mail: Mail): Promise<boolean> {
  if (isTest) {
    testOutbox.push(mail);
    return true;
  }
  if (!transport) {
    logger.info({ to: mail.to, subject: mail.subject }, `Email not sent (SMTP_HOST unset):\n${mail.text}`);
    return false;
  }
  try {
    await transport.sendMail({ from: env.SMTP_FROM, ...mail });
    return true;
  } catch (error) {
    logger.error({ err: error, to: mail.to }, 'Email delivery failed');
    return false;
  }
}

type Locale = 'en' | 'fr';
const pick = (locale: string): Locale => (locale === 'fr' ? 'fr' : 'en');
const signature = { en: '\n\nSentinel', fr: '\n\nSentinel' };

export const mail = {
  verifyRegistration(to: string, locale: string, name: string, link: string) {
    const l = pick(locale);
    return send({
      to,
      subject: l === 'fr' ? 'Confirmez votre adresse email' : 'Confirm your email address',
      text:
        (l === 'fr'
          ? `Bonjour ${name},\n\nConfirmez votre adresse pour activer votre organisation sur Sentinel. Le lien est valable 24 heures.\n\n${link}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`
          : `Hello ${name},\n\nConfirm your address to activate your organization on Sentinel. The link is valid for 24 hours.\n\n${link}\n\nIf you did not ask for this, ignore this message.`) +
        signature[l],
    });
  },

  invitation(
    to: string,
    locale: string,
    input: { name: string; organization: string; role: string; inviter: string; link: string },
  ) {
    const l = pick(locale);
    return send({
      to,
      subject: l === 'fr' ? `Invitation à rejoindre ${input.organization}` : `You're invited to ${input.organization}`,
      text:
        (l === 'fr'
          ? `Bonjour ${input.name},\n\n${input.inviter} vous invite à rejoindre ${input.organization} sur Sentinel en tant que ${input.role}. Le lien est valable 7 jours.\n\n${input.link}`
          : `Hello ${input.name},\n\n${input.inviter} invited you to join ${input.organization} on Sentinel as ${input.role}. The link is valid for 7 days.\n\n${input.link}`) +
        signature[l],
    });
  },

  passwordReset(to: string, locale: string, name: string, link: string) {
    const l = pick(locale);
    return send({
      to,
      subject: l === 'fr' ? 'Réinitialiser votre mot de passe' : 'Reset your password',
      text:
        (l === 'fr'
          ? `Bonjour ${name},\n\nChoisissez un nouveau mot de passe avec ce lien, valable 1 heure.\n\n${link}\n\nSi vous n'avez rien demandé, votre mot de passe reste inchangé.`
          : `Hello ${name},\n\nChoose a new password with this link. It is valid for 1 hour.\n\n${link}\n\nIf you did not ask for this, your password stays unchanged.`) +
        signature[l],
    });
  },

  organizationSuspended(to: string, locale: string, organization: string, reason: string) {
    const l = pick(locale);
    return send({
      to,
      subject: l === 'fr' ? `${organization} est suspendue` : `${organization} is suspended`,
      text:
        (l === 'fr'
          ? `L'accès à ${organization} sur Sentinel est suspendu.\n\nMotif : ${reason}\n\nVos données restent intactes. Répondez à ce message pour rétablir l'accès.`
          : `Access to ${organization} on Sentinel is suspended.\n\nReason: ${reason}\n\nYour data is untouched. Reply to this message to restore access.`) +
        signature[l],
    });
  },
};

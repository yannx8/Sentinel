/**
 * Creates a platform admin, or issues a new authenticator secret to one (docs/PRD.md F-PLT-05).
 * Platform admins exist only through this command, never through the UI, and are never
 * organization members (I12).
 *
 *   pnpm --filter @sentinel/api admin:create -- --email someone@sentinel.test --first Name --last Name
 *   pnpm --filter @sentinel/api admin:create -- --email someone@sentinel.test --reset-totp
 *
 * The password comes from PLATFORM_ADMIN_PASSWORD, or a random one is generated and printed once.
 */
import { randomBytes } from 'node:crypto';
import { emailSchema, passwordSchema, registerContactSchema } from '@sentinel/shared';
import type { z } from 'zod';
import { hashPassword, newTotpSecret } from '../lib/crypto';
import { prisma } from '../lib/prisma';

const USAGE =
  'Usage: pnpm --filter @sentinel/api admin:create -- --email <email> --first <first name> --last <last name> [--reset-totp]';

/** An expected refusal: printed without a stack trace. */
class CliError extends Error {
  constructor(
    message: string,
    readonly showUsage = false,
  ) {
    super(message);
  }
}

type Options = { email?: string; first?: string; last?: string; resetTotp: boolean; help: boolean };

const valueFlags = new Map<string, 'email' | 'first' | 'last'>([
  ['--email', 'email'],
  ['--first', 'first'],
  ['--last', 'last'],
]);

/** Accepts "--flag value" and "--flag=value". */
function parseArgs(argv: string[]): Options {
  const options: Options = { resetTotp: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';
    // pnpm forwards the "--" separator to the script.
    if (arg === '--') continue;
    if (arg === '--reset-totp') {
      options.resetTotp = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    const equals = arg.indexOf('=');
    const flag = equals === -1 ? arg : arg.slice(0, equals);
    const key = valueFlags.get(flag);
    if (!key) throw new CliError(`Unknown option ${arg}.`, true);
    const value = equals === -1 ? argv[++i] : arg.slice(equals + 1);
    if (value === undefined || value.startsWith('--')) throw new CliError(`Give a value after ${flag}.`, true);
    options[key] = value;
  }
  return options;
}

function valid<T>(schema: z.ZodType<T>, value: string | undefined, flag: string, rule: string): T {
  if (value === undefined) throw new CliError(`${flag} is required.`, true);
  const result = schema.safeParse(value);
  if (!result.success) throw new CliError(`${flag} ${rule}.`, true);
  return result.data;
}

async function choosePassword(): Promise<{ hash: string; generated: string | null }> {
  const fromEnv = process.env.PLATFORM_ADMIN_PASSWORD;
  if (fromEnv) {
    if (!passwordSchema.safeParse(fromEnv).success) {
      throw new CliError('PLATFORM_ADMIN_PASSWORD must be 10 to 128 characters long.');
    }
    return { hash: await hashPassword(fromEnv), generated: null };
  }
  const generated = randomBytes(18).toString('base64url');
  return { hash: await hashPassword(generated), generated };
}

function printAuthenticator(email: string, secret: string) {
  console.log(`TOTP secret: ${secret}`);
  console.log(`otpauth URL: otpauth://totp/Sentinel:${email}?secret=${secret}&issuer=Sentinel`);
  console.log(
    'Add the secret to an authenticator app (or scan the URL as a QR code), then sign in to the web console and enter the 6 digit code.',
  );
}

async function createAdmin(options: Options) {
  const email = valid(emailSchema, options.email, '--email', 'must be an email address');
  const firstName = valid(
    registerContactSchema.shape.firstName,
    options.first,
    '--first',
    'must be 1 to 60 characters',
  );
  const lastName = valid(registerContactSchema.shape.lastName, options.last, '--last', 'must be 1 to 60 characters');
  const password = await choosePassword();
  const totpSecret = newTotpSecret();

  await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { email },
      include: { platformAdmin: true, _count: { select: { memberships: true } } },
    });
    if (existing && existing._count.memberships > 0) {
      throw new CliError(
        `${email} belongs to an organization member. Platform admins are never organization members, so use another email.`,
      );
    }
    if (existing?.platformAdmin) {
      throw new CliError(`${email} is already a platform admin. Add --reset-totp to issue a new authenticator secret.`);
    }

    const account = {
      firstName,
      lastName,
      passwordHash: password.hash,
      status: 'ACTIVE' as const,
      emailVerifiedAt: new Date(),
      failedLoginCount: 0,
      lockedUntil: null,
    };
    // An account without any membership can be promoted. Its old sessions and reset links predate the new password.
    const user = existing
      ? await tx.user.update({ where: { id: existing.id }, data: account })
      : await tx.user.create({ data: { email, ...account } });
    if (existing) {
      await tx.session.deleteMany({ where: { userId: user.id } });
      await tx.userToken.deleteMany({ where: { userId: user.id } });
    }
    await tx.platformAdmin.create({ data: { userId: user.id, totpSecret } });
  });

  console.log(`Platform admin ready: ${firstName} ${lastName} <${email}>`);
  console.log(
    password.generated
      ? `Password (shown once, store it now): ${password.generated}`
      : 'Password: taken from PLATFORM_ADMIN_PASSWORD',
  );
  printAuthenticator(email, totpSecret);
}

async function resetTotp(options: Options) {
  const email = valid(emailSchema, options.email, '--email', 'must be an email address');
  const totpSecret = newTotpSecret();

  await prisma.$transaction(async (tx) => {
    const admin = await tx.platformAdmin.findFirst({ where: { user: { email } } });
    if (!admin)
      throw new CliError(`No platform admin uses ${email}. Run the command without --reset-totp to create one.`);
    await tx.platformAdmin.update({ where: { userId: admin.userId }, data: { totpSecret } });
    // Sessions verified with the old secret end now.
    await tx.session.deleteMany({ where: { userId: admin.userId } });
  });

  console.log(`New authenticator secret for ${email}. The password is unchanged and every session was signed out.`);
  printAuthenticator(email, totpSecret);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(USAGE);
    return;
  }
  await (options.resetTotp ? resetTotp(options) : createAdmin(options));
}

main()
  .catch((error: unknown) => {
    if (error instanceof CliError) {
      console.error(error.message);
      if (error.showUsage) console.error(USAGE);
    } else {
      console.error(error);
    }
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

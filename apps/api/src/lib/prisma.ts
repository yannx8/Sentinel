import { PrismaClient } from '@prisma/client';

// Prisma's 5 s default aborts a write that merely waited on a busy or slow disk; fail at 20 s instead.
export const prisma = new PrismaClient({ transactionOptions: { maxWait: 10_000, timeout: 20_000 } });

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

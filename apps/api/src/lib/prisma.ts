import { PrismaClient } from '@prisma/client';
// Singleton PrismaClient to avoid exhausting connection pools in development (HMR)
export const prisma = new PrismaClient();

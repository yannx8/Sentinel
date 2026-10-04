import { Request, Response } from 'express';
import { Webhook } from 'svix';
import { prisma } from '../../lib/prisma.js';
import { z } from 'zod';

const clerkWebhookPayloadSchema = z.object({
  type: z.enum(['user.created', 'user.updated', 'user.deleted']),
  data: z.object({
    id: z.string(),
    email_addresses: z.array(
      z.object({
        email_address: z.string(),
      })
    ).optional(),
    first_name: z.string().nullable().optional(),
    last_name: z.string().nullable().optional(),
  }),
});

export const handleClerkWebhook = async (req: Request, res: Response) => {
  const payload = req.body;
  const headers = req.headers as Record<string, string>;
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return res.status(500).json({ error: 'Missing CLERK_WEBHOOK_SECRET' });
  }

  const wh = new Webhook(webhookSecret);
  let evt: any;

  try {
    evt = wh.verify(payload, headers);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  const parseResult = clerkWebhookPayloadSchema.safeParse(evt);
  if (!parseResult.success) {
    // If it's not a user event or invalid shape, we just acknowledge and ignore it (or log it)
    return res.status(200).json({ success: true, message: 'Ignored unsupported event type' });
  }

  const { type, data } = parseResult.data;
  const { id, email_addresses, first_name, last_name } = data;

  try {
    if (type === 'user.created') {
      const primaryEmail = email_addresses?.[0]?.email_address;
      await prisma.user.create({
        data: { clerkUserId: id, email: primaryEmail || '', firstName: first_name || '', lastName: last_name || '' },
      });
    } else if (type === 'user.updated') {
      const primaryEmail = email_addresses?.[0]?.email_address;
      await prisma.user.update({
        where: { clerkUserId: id },
        data: { email: primaryEmail || '', firstName: first_name || '', lastName: last_name || '' },
      });
    } else if (type === 'user.deleted') {
      await prisma.user.delete({
        where: { clerkUserId: id },
      });
    }
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Clerk webhook sync failed:', error);
    return res.status(500).json({ error: 'Database synchronization failed' });
  }
};

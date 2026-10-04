import { Router } from 'express';
import express from 'express';
import { handleClerkWebhook } from './webhooks.controller.js';

const router = Router();

router.post('/clerk', express.raw({ type: 'application/json' }), handleClerkWebhook);

export default router;

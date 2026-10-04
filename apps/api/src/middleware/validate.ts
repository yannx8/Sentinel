import { Request, Response, NextFunction } from 'express';
import { ZodType } from 'zod';

export const validate = (schema: ZodType) => (req: Request, _res: Response, next: NextFunction) => {
  const r = schema.safeParse(req.body);
  if (!r.success) {
    return next(Object.assign(new Error(r.error.issues[0]?.message ?? 'Invalid request'), {
      code: 'VALIDATION_ERROR',
      status: 400
    }));
  }
  req.body = r.data;
  next();
};

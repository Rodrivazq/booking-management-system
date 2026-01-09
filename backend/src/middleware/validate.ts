import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

const validate = (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
    try {
        schema.parse(req.body);
        next();
    } catch (err: any) {
        if (err.errors) {
            const errorMessages = err.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
            return res.status(400).json({ error: errorMessages });
        }
        return res.status(400).json({ error: 'Datos inválidos' });
    }
};

export default validate;

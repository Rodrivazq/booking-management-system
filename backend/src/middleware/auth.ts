import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env';
import prisma from '../utils/prisma';

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.replace('Bearer ', '') : null;
    if (!token) return res.status(401).json({ error: 'No autorizado' });
    try {
        const payload = jwt.verify(token, JWT_SECRET) as any;
        req.user = payload;

        try {
            const settings = await prisma.settings.findFirst();
            if (settings?.maintenanceMode && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
                return res.status(503).json({ error: 'El sistema esta en mantenimiento. Intente mas tarde.' });
            }
        } catch (e) {
            console.error('Error checking maintenance mode:', e);
        }

        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token invalido' });
    }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
    if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') return res.status(403).json({ error: 'Solo administradores' });
    next();
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
    if (req.user?.role !== 'superadmin') return res.status(403).json({ error: 'Requiere privilegios de Super Admin' });
    next();
}

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
        
        // Fetch real-time user data from DB to prevent privilege persistence
        const user = await prisma.user.findUnique({
            where: { id: payload.id },
            select: { id: true, name: true, email: true, role: true, funcNumber: true }
        });

        if (!user) {
            return res.status(401).json({ error: 'Usuario no encontrado o sesión inválida' });
        }

        // Rebuild req.user with current DB data, ignoring JWT role
        req.user = user as any;

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

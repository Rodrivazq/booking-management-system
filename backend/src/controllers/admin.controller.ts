import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma';

export const updateUserDetails = async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { funcNumber, email, phoneNumber, documentId } = req.body || {};

    try {
        const normalizedFunc = funcNumber ? String(funcNumber).replace(/\s+/g, '').toUpperCase() : undefined;
        // Check for conflicts
        if (normalizedFunc) {
            const exists = await prisma.user.findFirst({
                where: {
                    funcNumber: normalizedFunc,
                    NOT: { id: userId }
                }
            });
            if (exists) return res.status(400).json({ error: 'Numero de funcionario ya asignado a otro usuario' });
        }

        if (documentId) {
            const normalizedDoc = String(documentId).trim();
            const exists = await prisma.user.findFirst({
                where: {
                    documentId: normalizedDoc,
                    NOT: { id: userId }
                }
            });
            if (exists) return res.status(400).json({ error: 'Ese documento (C.I.) ya esta registrado por otro usuario' });
        }

        if (email) {
            const exists = await prisma.user.findFirst({
                where: {
                    email: String(email).trim().toLowerCase(),
                    NOT: { id: userId }
                }
            });
            if (exists) return res.status(400).json({ error: 'Correo ya registrado por otro usuario' });
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                ...(normalizedFunc && { funcNumber: normalizedFunc }),
                ...(documentId && { documentId: String(documentId).trim() }),
                ...(email && { email: String(email).trim().toLowerCase() }),
                ...(phoneNumber && { phoneNumber: String(phoneNumber).trim() })
            }
        });

        res.json({ ok: true, user: { id: updatedUser.id, name: updatedUser.name, email: updatedUser.email, funcNumber: updatedUser.funcNumber, phoneNumber: updatedUser.phoneNumber, documentId: updatedUser.documentId } });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Error al actualizar usuario' });
    }
};

export const createUser = async (req: Request, res: Response) => {
    const { name, email, password, funcNumber, documentId, phoneNumber, role, photoUrl } = req.body || {};
    const creatorRole = req.user.role;

    if (!name || !email || !password || !funcNumber || !documentId || !photoUrl) return res.status(400).json({ error: 'Faltan datos obligatorios, incluyendo foto de perfil y documento' });

    // Role validation
    if (role === 'superadmin' && creatorRole !== 'superadmin') {
        return res.status(403).json({ error: 'Solo Super Admins pueden crear otros Super Admins' });
    }

    try {
        const normalizedEmail = String(email).trim().toLowerCase();
        const normalizedFunc = String(funcNumber).replace(/\s+/g, '').toUpperCase();
        const normalizedDoc = String(documentId).trim();
        
        const exists = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (exists) return res.status(400).json({ error: 'El correo ya esta registrado' });

        const existsFunc = await prisma.user.findUnique({ where: { funcNumber: normalizedFunc } });
        if (existsFunc) return res.status(400).json({ error: 'Ese numero de funcionario ya esta registrado' });

        const existsDoc = await prisma.user.findUnique({ where: { documentId: normalizedDoc } });
        if (existsDoc) return res.status(400).json({ error: 'Ese documento ya esta registrado' });

        const passwordHash = await bcrypt.hash(password, 10);

        const newUser = await prisma.user.create({
            data: {
                name,
                email: normalizedEmail,
                passwordHash,
                role: role || 'user',
                funcNumber: normalizedFunc,
                documentId: normalizedDoc,
                phoneNumber: phoneNumber ? String(phoneNumber).trim() : null,
                photoUrl
            }
        });

        res.json({ ok: true, user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role, funcNumber: newUser.funcNumber, documentId: newUser.documentId } });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Error al crear usuario' });
    }
};

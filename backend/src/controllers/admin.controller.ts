import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma';
import { sendAdminCreatedUserEmail } from '../services/email.service';
import { validateImageUrl } from '../utils/validators';

export const updateUserDetails = async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { funcNumber, email, phoneNumber, documentId } = req.body || {};

    try {
        const targetUser = await prisma.user.findUnique({ where: { id: userId } });
        if (!targetUser) return res.status(404).json({ error: 'Usuario no encontrado' });

        if (targetUser.role === 'superadmin' && req.user.role !== 'superadmin') {
            return res.status(403).json({ error: 'Un Administrador no puede editar a un Super Admin' });
        }

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

    if (!name || !email || !password || !funcNumber || !documentId) return res.status(400).json({ error: 'Faltan datos obligatorios (nombre, email, contraseña, nro. funcionario, documento)' });

    if (photoUrl !== undefined && !validateImageUrl(photoUrl)) {
        return res.status(400).json({ error: 'URL de imagen inválida o demasiado larga. No se permiten imágenes base64.' });
    }

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
                photoUrl: photoUrl || null,
                // Admin-created users are pre-verified — they don't go through the email flow
                isEmailVerified: true,
            }
        });

        // Send a welcome email explaining they can use "forgot password" to set one if needed
        const emailSent = await sendAdminCreatedUserEmail(newUser);

        res.json({ 
            ok: true, 
            emailSent,
            warning: !emailSent ? 'El usuario fue creado, pero el proveedor de correo no está configurado o falló. Por favor, infórmale sus credenciales manualmente.' : undefined,
            user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role, funcNumber: newUser.funcNumber, documentId: newUser.documentId } 
        });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Error al crear usuario' });
    }
};

export const changeUserRole = async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { role } = req.body || {};
    const validRoles = ['user', 'admin', 'superadmin'];

    if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Rol inválido. Valores permitidos: user, admin, superadmin' });
    }

    // Rule 1: Never allow self-role change
    if (req.user.id === userId) {
        return res.status(400).json({ error: 'No puedes cambiar tu propio rol' });
    }

    try {
        const target = await prisma.user.findUnique({ where: { id: userId } });
        if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });

        // Rule 2: If we are demoting a superadmin, ensure they are not the last one
        const isDemotingSuperadmin = target.role === 'superadmin' && role !== 'superadmin';
        if (isDemotingSuperadmin) {
            const superadminCount = await prisma.user.count({ where: { role: 'superadmin' } });
            if (superadminCount <= 1) {
                return res.status(400).json({
                    error: 'No puedes quitar el rol al único Super Admin del sistema.'
                });
            }
        }

        const updated = await prisma.user.update({
            where: { id: userId },
            data: { role }
        });

        res.json({ ok: true, user: { id: updated.id, name: updated.name, role: updated.role } });
    } catch (error) {
        console.error('Change role error:', error);
        res.status(500).json({ error: 'Error al cambiar el rol del usuario' });
    }
};

export const previewUsersImport = async (req: Request, res: Response) => {
    try {
        const { users } = req.body || {};

        if (!Array.isArray(users)) {
            return res.status(400).json({ error: 'El payload debe contener un array "users"' });
        }

        if (users.length > 500) {
            return res.status(400).json({ error: 'La validación admite hasta 500 usuarios por archivo.' });
        }

        const validRows: any[] = [];
        const errors: any[] = [];
        const duplicateEmails: string[] = [];
        const duplicateFuncs: string[] = [];
        const duplicateDocs: string[] = [];

        // Extract all values to check against DB in bulk
        const emailsToCheck = users.map(u => String(u?.email || '').trim().toLowerCase()).filter(Boolean);
        const funcsToCheck = users.map(u => String(u?.funcNumber || '').replace(/\s+/g, '').toUpperCase()).filter(Boolean);
        const docsToCheck = users.map(u => String(u?.documentId || '').trim()).filter(Boolean);

        // Fetch existing records
        const [existingEmails, existingFuncs, existingDocs] = await Promise.all([
            prisma.user.findMany({ where: { email: { in: emailsToCheck } }, select: { email: true } }),
            prisma.user.findMany({ where: { funcNumber: { in: funcsToCheck } }, select: { funcNumber: true } }),
            prisma.user.findMany({ where: { documentId: { in: docsToCheck } }, select: { documentId: true } })
        ]);

        const dbEmails = new Set(existingEmails.map(u => u.email));
        const dbFuncs = new Set(existingFuncs.map(u => u.funcNumber));
        const dbDocs = new Set(existingDocs.map(u => u.documentId));

        // Track internal duplicates within the CSV
        const seenEmails = new Set<string>();
        const seenFuncs = new Set<string>();
        const seenDocs = new Set<string>();

        users.forEach((user, index) => {
            const rowNum = index + 1;
            const rowErrors: string[] = [];

            const { name, email, funcNumber, documentId, phoneNumber, role } = user || {};
            const normalizedName = String(name || '').trim();
            const normalizedEmail = String(email || '').trim().toLowerCase();
            const normalizedFunc = String(funcNumber || '').replace(/\s+/g, '').toUpperCase();
            const normalizedDoc = String(documentId || '').trim();
            const normalizedPhone = phoneNumber ? String(phoneNumber).trim() : null;
            const normalizedRole = role ? String(role).trim().toLowerCase() : 'user';
            const safeRow = {
                name: normalizedName,
                email: normalizedEmail,
                funcNumber: normalizedFunc,
                documentId: normalizedDoc,
                phoneNumber: normalizedPhone,
                role: normalizedRole,
            };

            if (!normalizedName || !normalizedEmail || !normalizedFunc || !normalizedDoc) {
                rowErrors.push('Faltan campos obligatorios (nombre, email, funcNumber, documentId).');
            }

            if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
                rowErrors.push(`Email inválido: ${normalizedEmail}`);
            }

            // 1. Check duplicates against DB
            if (normalizedEmail && dbEmails.has(normalizedEmail)) {
                rowErrors.push(`Email ya existe en el sistema: ${normalizedEmail}`);
                if (!duplicateEmails.includes(normalizedEmail)) duplicateEmails.push(normalizedEmail);
            }
            if (normalizedFunc && dbFuncs.has(normalizedFunc)) {
                rowErrors.push(`Número de funcionario ya existe: ${normalizedFunc}`);
                if (!duplicateFuncs.includes(normalizedFunc)) duplicateFuncs.push(normalizedFunc);
            }
            if (normalizedDoc && dbDocs.has(normalizedDoc)) {
                rowErrors.push(`Documento ya existe: ${normalizedDoc}`);
                if (!duplicateDocs.includes(normalizedDoc)) duplicateDocs.push(normalizedDoc);
            }

            // 2. Check internal duplicates in the payload
            if (normalizedEmail && seenEmails.has(normalizedEmail)) {
                rowErrors.push(`Email duplicado en el mismo archivo: ${normalizedEmail}`);
            }
            if (normalizedFunc && seenFuncs.has(normalizedFunc)) {
                rowErrors.push(`Número de funcionario duplicado en el mismo archivo: ${normalizedFunc}`);
            }
            if (normalizedDoc && seenDocs.has(normalizedDoc)) {
                rowErrors.push(`Documento duplicado en el mismo archivo: ${normalizedDoc}`);
            }

            seenEmails.add(normalizedEmail);
            seenFuncs.add(normalizedFunc);
            seenDocs.add(normalizedDoc);

            // Role validation
            if (!['user', 'admin'].includes(normalizedRole)) {
                rowErrors.push('Rol inválido (solo user o admin para importación).');
            }

            if (rowErrors.length > 0) {
                errors.push({ row: rowNum, data: safeRow, reasons: rowErrors });
            } else {
                validRows.push(safeRow);
            }
        });

        res.json({
            ok: true,
            summary: {
                totalReceived: users.length,
                validCount: validRows.length,
                errorCount: errors.length
            },
            validRows,
            errors,
            duplicates: {
                emails: duplicateEmails,
                funcs: duplicateFuncs,
                docs: duplicateDocs
            }
        });
    } catch (error) {
        console.error('Error previewing users import:', error);
        res.status(500).json({ error: 'Error al validar la importación de usuarios' });
    }
};

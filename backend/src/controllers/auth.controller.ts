import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import prisma from '../utils/prisma';
import { JWT_SECRET, FRONTEND_URL, SMTP, RESEND_API_KEY } from '../config/env';

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

function createTransport() {
    if (!SMTP.host) return null;
    return nodemailer.createTransport({
        host: SMTP.host,
        port: Number(SMTP.port) || 587,
        secure: SMTP.secure,
        auth: SMTP.user ? { user: SMTP.user, pass: SMTP.pass || '' } : undefined,
    });
}

const mailer = createTransport();

const getNextMonday = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = (8 - day) % 7 || 7;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + diff);
    nextMonday.setHours(0, 0, 0, 0);
    return nextMonday.toISOString().slice(0, 10);
};

export const register = async (req: Request, res: Response) => {
    const { name, email, password, funcNumber, documentId, phoneNumber, photoUrl } = req.body || {};
    if (!name || !email || !password || !funcNumber || !documentId || !photoUrl) return res.status(400).json({ error: 'Nombre, correo, contrasena, numero de funcionario, documento y foto de perfil son obligatorios' });

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedFunc = String(funcNumber).replace(/\s+/g, '').toUpperCase();
    const normalizedDoc = String(documentId).trim();
    
    // Validacion temporal (reemplazar con dominio real si aplica, ej. @empresa.com)
    const allowedDomains = ['empresa.com']; // CONFIGURAR EL DOMINIO REQUERIDO AQUÍ
    const emailDomain = normalizedEmail.split('@')[1];

    // Por ahora deshabilitado para no romper, pero dejamos el codigo listo.
    // if (!emailDomain || !allowedDomains.includes(emailDomain)) {
    //    return res.status(403).json({ error: 'Solo se permiten correos corporativos' });
    // }

    try {
        const existingEmail = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (existingEmail) return res.status(400).json({ error: 'El correo ya esta registrado' });

        const existingFunc = await prisma.user.findUnique({ where: { funcNumber: normalizedFunc } });
        if (existingFunc) return res.status(400).json({ error: 'Ese numero de funcionario ya esta registrado' });

        const existingDoc = await prisma.user.findUnique({ where: { documentId: normalizedDoc } });
        if (existingDoc) return res.status(400).json({ error: 'El documento ya esta registrado' });

        const passwordHash = bcrypt.hashSync(password, 10);
        
        const user = await prisma.user.create({
            data: {
                name,
                email: normalizedEmail,
                passwordHash,
                role: 'user',
                funcNumber: normalizedFunc,
                documentId: normalizedDoc,
                phoneNumber: phoneNumber ? String(phoneNumber).trim() : null,
                photoUrl
            }
        });

        const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role, funcNumber: user.funcNumber }, JWT_SECRET, { expiresIn: '12h' });
        res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, funcNumber: user.funcNumber, phoneNumber: user.phoneNumber } });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Error al registrar usuario' });
    }
};

export const login = async (req: Request, res: Response) => {
    const { email, password, identifier, keepSession } = req.body || {};
    const searchRaw = String(identifier || email || '').trim();
    const isEmailSearch = searchRaw.includes('@');
    const search = isEmailSearch ? searchRaw.toLowerCase() : searchRaw.replace(/\s+/g, '').toUpperCase();
    
    const fs = require('fs');

    try {
        fs.appendFileSync('auth_debug.log', `\n[${new Date().toISOString()}] Login attempt: search=${search}`);
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: searchRaw.toLowerCase() },
                    { funcNumber: searchRaw.replace(/\s+/g, '').toUpperCase() }
                ]
            }
        });

        if (!user) {
            fs.appendFileSync('auth_debug.log', `\nUser not found for search=${search}`);
            return res.status(401).json({ error: 'Credenciales invalidas' });
        }

        const ok = bcrypt.compareSync(password || '', user.passwordHash);
        fs.appendFileSync('auth_debug.log', `\nUser found: ${user.email}, Hash: ${user.passwordHash.substring(0, 10)}..., PwdCheck: ${ok}`);
        
        if (!ok) return res.status(401).json({ error: 'Credenciales invalidas' });

        const expiresIn = keepSession ? '30d' : '12h';
        const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role, funcNumber: user.funcNumber }, JWT_SECRET, { expiresIn });
        res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, funcNumber: user.funcNumber, phoneNumber: user.phoneNumber } });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Error al iniciar sesion' });
    }
};

export const forgotPassword = async (req: Request, res: Response) => {
    const { identifier } = req.body || {};
    const searchRaw = (identifier || '').trim();

    if (!searchRaw) return res.status(400).json({ error: 'Debe indicar correo o numero de funcionario' });

    try {
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: searchRaw.toLowerCase() },
                    { funcNumber: searchRaw }
                ]
            }
        });

        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

        const token = uuidv4();
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

        // Delete existing resets for this user
        await prisma.passwordReset.deleteMany({ where: { userId: user.id } });

        await prisma.passwordReset.create({
            data: {
                token,
                userId: user.id,
                expiresAt
            }
        });

        const resetUrl = `${FRONTEND_URL}/reset?token=${token}`;

        if (resend) {
            try {
                const data = await resend.emails.send({
                    from: 'App de Reservas <acceso@resend.dev>', // You should verify a domain in Resend later
                    to: [user.email],
                    subject: 'Restablecer contraseña',
                    html: `
                    <div style="font-family: Arial, sans-serif; background-color: #f4f4f5; padding: 40px 20px; text-align: center;">
                        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                            <h2 style="color: #111827; font-size: 24px; margin-bottom: 20px; font-weight: bold;">App de Reservas</h2>
                            <h3 style="color: #374151; font-size: 20px; margin-bottom: 20px;">Restablecimiento de Contraseña</h3>
                            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                                Hola <strong>${user.name}</strong> 👋.<br><br>Hemos recibido una solicitud para restablecer tu contraseña. Si fuiste tú, puedes hacerlo haciendo clic en el siguiente botón:
                            </p>
                            <a href="${resetUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: bold; font-size: 16px;">
                                Definir nueva contraseña
                            </a>
                            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                                Este botón será válido por <strong>1 hora</strong>. Si no solicitaste este cambio, simplemente ignora este correo y tu cuenta seguirá segura.
                            </p>
                            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                            <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">
                                Si tienes problemas con el botón, copia y pega este enlace en tu navegador:<br>
                                <a href="${resetUrl}" style="color: #2563eb; word-break: break-all;">${resetUrl}</a>
                            </p>
                        </div>
                    </div>
                    `
                });
                console.log("Resend data:", data);
            } catch (error) {
                console.error("Resend error:", error);
            }
        } else if (mailer) {
            mailer.sendMail({
                to: user.email,
                from: SMTP.from,
                subject: 'Restablecer contrasena',
                text: `Ingresa a ${resetUrl} para definir una nueva contrasena. El enlace expira en 1 hora.`,
                html: `<p>Ingresa a <a href="${resetUrl}">${resetUrl}</a> para definir una nueva contrasena.</p><p>Vence en 1 hora.</p>`
            }).catch((err) => console.error('No se pudo enviar email de reset', err));
        } else {
            console.log('Reset link:', resetUrl);
        }

        res.json({ ok: true });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Error al procesar solicitud' });
    }
};

export const resetPassword = async (req: Request, res: Response) => {
    const { token, password } = req.body || {};
    if (!token || !password) return res.status(400).json({ error: 'Token y contrasena son obligatorios' });

    try {
        const resetEntry = await prisma.passwordReset.findUnique({
            where: { token },
            include: { user: true }
        });

        if (!resetEntry || resetEntry.expiresAt < new Date()) {
            return res.status(400).json({ error: 'Token invalido o expirado' });
        }

        const passwordHash = bcrypt.hashSync(password, 10);

        await prisma.user.update({
            where: { id: resetEntry.userId },
            data: { passwordHash }
        });

        await prisma.passwordReset.delete({ where: { token } });

        res.json({ ok: true });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Error al restablecer contrasena' });
    }
};

export const me = async (req: Request, res: Response) => {
    try {
        if (!req.user || !req.user.id) return res.status(401).json({ error: 'No user ID in request' });
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
        
        let preferences = {};
        try {
            preferences = user.preferences ? JSON.parse(user.preferences as string) : {};
        } catch (e) {}

        res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, funcNumber: user.funcNumber, phoneNumber: user.phoneNumber, photoUrl: user.photoUrl, preferences }, nextMonday: getNextMonday() });
    } catch (error) {
        console.error('Me error:', error);
        res.status(500).json({ error: 'Error al obtener perfil' });
    }
};

export const updateProfile = async (req: Request, res: Response) => {
    const { name, phoneNumber, photoUrl, currentPassword, newPassword, preferences } = req.body || {};
    const userId = req.user.id;

    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

        const dataToUpdate: any = {};
        if (name) dataToUpdate.name = name;
        if (phoneNumber !== undefined) dataToUpdate.phoneNumber = phoneNumber;
        if (photoUrl !== undefined) dataToUpdate.photoUrl = photoUrl;
        
        if (preferences) {
            let currentPrefs = {};
            try {
                currentPrefs = user.preferences ? JSON.parse(user.preferences as string) : {};
            } catch (e) {}
            dataToUpdate.preferences = JSON.stringify({ ...currentPrefs, ...preferences });
        }

        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({ error: 'Se requiere la contraseña actual para establecer una nueva' });
            }
            const ok = bcrypt.compareSync(currentPassword, user.passwordHash);
            if (!ok) {
                return res.status(400).json({ error: 'La contraseña actual es incorrecta' });
            }
            dataToUpdate.passwordHash = bcrypt.hashSync(newPassword, 10);
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: dataToUpdate
        });

        let updatedPrefs = {};
        try {
            updatedPrefs = updatedUser.preferences ? JSON.parse(updatedUser.preferences as string) : {};
        } catch (e) {}

        res.json({
            user: {
                id: updatedUser.id,
                name: updatedUser.name,
                email: updatedUser.email,
                role: updatedUser.role,
                funcNumber: updatedUser.funcNumber,
                phoneNumber: updatedUser.phoneNumber,
                photoUrl: updatedUser.photoUrl,
                preferences: updatedPrefs
            },
            message: 'Perfil actualizado con éxito'
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Error al actualizar perfil' });
    }
};

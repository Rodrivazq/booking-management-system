import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../utils/prisma';
import logger from '../utils/logger';
import { verifyTurnstileToken } from '../utils/turnstile';
import { JWT_SECRET, FRONTEND_URL, TURNSTILE_SECRET_KEY } from '../config/env';
import { getNextMonday } from '../utils/dates';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/email.service';
import { validateImageUrl } from '../utils/validators';


export const register = async (req: Request, res: Response) => {
    const { name, email, password, funcNumber, documentId, phoneNumber, photoUrl, turnstileToken } = req.body || {};
    if (!name || !email || !password || !funcNumber || !documentId) {
        return res.status(400).json({ error: 'Todos los campos obligatorios son requeridos' });
    }

    if (!validateImageUrl(photoUrl)) {
        return res.status(400).json({ error: 'URL de imagen inválida o demasiado larga. No se permiten imágenes base64.' });
    }

    if (TURNSTILE_SECRET_KEY && !turnstileToken) {
        return res.status(400).json({ error: 'Validación antibot requerida' });
    }

    if (TURNSTILE_SECRET_KEY || turnstileToken) {
        const isValidToken = await verifyTurnstileToken(turnstileToken, req.ip || '');
        if (!isValidToken) return res.status(400).json({ error: 'Validación anti-bot fallida.' });
    }

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
        
        const verificationToken = uuidv4();
        
        const user = await prisma.user.create({
            data: {
                name,
                email: normalizedEmail,
                passwordHash,
                role: 'user',
                funcNumber: normalizedFunc,
                documentId: normalizedDoc,
                phoneNumber: phoneNumber ? String(phoneNumber).trim() : null,
                photoUrl,
                verificationToken,
                isEmailVerified: false
            }
        });

        const verifyUrl = `${FRONTEND_URL}/verify-email?token=${verificationToken}`;

        const emailSent = await sendVerificationEmail(user, verifyUrl);

        if (!emailSent) {
            return res.status(201).json({ 
                message: 'Registro exitoso, pero ocurrió un problema técnico al enviar el correo de verificación. Por favor, contacta a un administrador para que active tu cuenta.',
                warning: true 
            });
        }

        res.status(201).json({ message: 'Registro exitoso. Revisa tu correo para verificar tu cuenta antes de ingresar.' });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Error al registrar usuario' });
    }
};

// ─── POST /api/auth/resend-verification ────────────────────────────────────
// Re-sends the verification email if the user exists and is not yet verified.
// Always returns the same neutral response to prevent account enumeration:
// callers can't tell whether the email is registered or not.
//
// Combined with the resendVerificationLimiter (3/15min per IP) this is safe
// against brute-force probing and Resend quota abuse.
export const resendVerification = async (req: Request, res: Response) => {
    const { email } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();

    const NEUTRAL_RESPONSE = {
        ok: true,
        message: 'Si la cuenta existe y necesita verificación, te reenviamos el correo. Revisá tu bandeja de entrada y la carpeta de SPAM en unos minutos.'
    };

    try {
        const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

        // User not found OR already verified: neutral response, no email sent.
        // Anti-enumeration: caller cannot distinguish these cases.
        if (!user || user.isEmailVerified) {
            return res.json(NEUTRAL_RESPONSE);
        }

        // Regenerate token (invalidates any previous link sent before).
        const verificationToken = uuidv4();
        await prisma.user.update({
            where: { id: user.id },
            data: { verificationToken },
        });

        const verifyUrl = `${FRONTEND_URL}/verify-email?token=${verificationToken}`;
        const emailSent = await sendVerificationEmail(user, verifyUrl);

        if (!emailSent) {
            logger.error(`[ResendVerification] Failed to send verification email to ${user.email}`);
        }

        return res.json(NEUTRAL_RESPONSE);
    } catch (error) {
        console.error('Resend verification error:', error);
        return res.status(500).json({ error: 'Error al procesar la solicitud' });
    }
};

export const verifyEmail = async (req: Request, res: Response) => {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: 'Token de verificación faltante o inválido' });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { verificationToken: token }
        });

        if (!user) {
            // Token not found. Two possible causes, indistinguishable from
            // here: (a) the user already used this link (we null the token
            // after successful verify), or (b) the link is bogus/expired.
            // The safe response covers both without alarming a user who is
            // already correctly verified.
            return res.status(400).json({
                error: 'Este enlace ya fue utilizado o no es válido. Si tu cuenta ya está verificada, podés iniciar sesión normalmente.'
            });
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                isEmailVerified: true,
                verificationToken: null
            }
        });

        res.json({ message: 'Correo verificado exitosamente. Ya podés iniciar sesión.' });
    } catch (error) {
        console.error('Verify Email error:', error);
        res.status(500).json({ error: 'Ocurrió un error al verificar el correo.' });
    }
};

export const login = async (req: Request, res: Response) => {
    const { email, password, identifier, keepSession, turnstileToken } = req.body || {};
    const searchRaw = String(identifier || email || '').trim();
    const isEmailSearch = searchRaw.includes('@');
    const search = isEmailSearch ? searchRaw.toLowerCase() : searchRaw.replace(/\s+/g, '').toUpperCase();
    
    if (TURNSTILE_SECRET_KEY && !turnstileToken) {
       return res.status(400).json({ error: 'Validación antibot requerida' });
    }
    
    if (TURNSTILE_SECRET_KEY || turnstileToken) {
        const isValidToken = await verifyTurnstileToken(turnstileToken, req.ip || '');
        if (!isValidToken) return res.status(400).json({ error: 'Validación anti-bot fallida.' });
    }

    try {
        logger.info(`[${new Date().toISOString()}] Login attempt: search=${search}`);
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: searchRaw.toLowerCase() },
                    { funcNumber: searchRaw.replace(/\s+/g, '').toUpperCase() }
                ]
            }
        });

        if (!user) return res.status(401).json({ error: 'Credenciales invalidas' });

        const ok = bcrypt.compareSync(password || '', user.passwordHash);
        if (!ok) return res.status(401).json({ error: 'Credenciales invalidas' });

        if (!user.isEmailVerified && user.role === 'user') {
            return res.status(403).json({ error: 'Debes verificar tu correo electronico antes de iniciar sesion. Revisa tu bandeja de entrada o la carpeta de SPAM.' });
        }

        const expiresIn = keepSession ? '30d' : '12h';
        // IMPORTANT: Do NOT put photoUrl in JWT payload, it breaks HTTP Header limits if it's Base64!
        const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role, funcNumber: user.funcNumber }, JWT_SECRET, { expiresIn });
        res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, funcNumber: user.funcNumber, phoneNumber: user.phoneNumber, photoUrl: user.photoUrl } });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Error al iniciar sesion' });
    }
};

export const forgotPassword = async (req: Request, res: Response) => {
    const { email, identifier } = req.body || {};
    // Use email explicitly if provided, otherwise fallback to identifier (for backwards compatibility)
    const rawInput = (email || identifier || '').trim();

    if (!rawInput) return res.status(400).json({ error: 'Debe indicar su correo electrónico.' });

    try {
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: rawInput.toLowerCase() },
                    { funcNumber: rawInput } // Fallback just in case, though frontend now asks for email
                ]
            }
        });

        // Neutral response to avoid user enumeration
        if (!user) {
            return res.json({ ok: true, message: 'Si el correo existe, recibirás un enlace para restablecer tu contraseña.' });
        }

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

        const emailSent = await sendPasswordResetEmail(user, resetUrl);

        if (!emailSent) {
            logger.error(`Failed to send password reset email to ${user.email}`);
        }

        res.json({ ok: true, message: 'Si el correo existe, recibirás un enlace para restablecer tu contraseña.' });
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

    if (photoUrl !== undefined && !validateImageUrl(photoUrl)) {
        return res.status(400).json({ error: 'URL de imagen inválida o demasiado larga. No se permiten imágenes base64.' });
    }

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

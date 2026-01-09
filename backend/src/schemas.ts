import { z } from 'zod';

export const registerSchema = z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').regex(/^[a-zA-Z\s]+$/, 'El nombre solo puede contener letras y espacios'),
    email: z.string().email('Correo electrónico inválido'),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
    funcNumber: z.string().min(1, 'El número de funcionario es obligatorio').regex(/^[a-zA-Z0-9]+$/, 'El número de funcionario solo puede contener letras y números'),
    phoneNumber: z.string().optional(),
});

export const loginSchema = z.object({
    identifier: z.string().optional(), // Can be email or funcNumber
    email: z.string().email().optional(),
    password: z.string().min(1, 'La contraseña es obligatoria'),
    keepSession: z.boolean().optional(),
}).refine(data => data.identifier || data.email, {
    message: "Debe proporcionar un correo o número de funcionario",
    path: ["identifier"],
});

export const reservationSchema = z.object({
    weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de semana inválido (YYYY-MM-DD)'),
    selections: z.array(z.object({
        day: z.string(),
        meal: z.string(),
        dessert: z.string(),
        bread: z.boolean().optional(),
    })).min(5, 'Debe seleccionar opciones para los 5 días'),
    timeSlot: z.string().min(1, 'El horario es obligatorio'),
});

import { z } from 'zod';

export const registerSchema = z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').regex(/^[a-zA-ZÁÉÍÓÚáéíóúÑñÜü\s']+$/, 'El nombre solo puede contener letras, espacios y apóstrofes'),
    email: z.string().email('Correo electrónico inválido'),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
    funcNumber: z.string().min(1, 'El número de funcionario es obligatorio').regex(/^[a-zA-Z0-9]+$/, 'El número de funcionario solo puede contener letras y números'),
    documentId: z.string().min(1, 'El documento es obligatorio').regex(/^[0-9]+$/, 'El documento solo puede contener números'),
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

// Schema para PUT /api/settings. Todos los campos opcionales (es un partial
// update) y respeta exactamente los campos del modelo Settings en
// prisma/schema.prisma. Ranges:
//   - deadlineDay: 0-6 (0 = domingo, 6 = sábado)
//   - deadlineTime: HH:MM en 24h ("00:00".."23:59")
//   - announcementType: uno de los valores conocidos por la UI
export const updateSettingsSchema = z.object({
    companyName: z.string().min(1).max(120).optional(),
    logoUrl: z.string().max(500).nullable().optional(),
    primaryColor: z.string().max(40).nullable().optional(),
    secondaryColor: z.string().max(40).nullable().optional(),
    deadlineDay: z.number().int().min(0).max(6).optional(),
    deadlineTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Formato HH:MM (00:00 a 23:59)').optional(),
    supportEmail: z.string().email().nullable().optional(),
    supportPhone: z.string().max(40).nullable().optional(),
    welcomeTitle: z.string().max(200).nullable().optional(),
    welcomeMessage: z.string().max(1000).nullable().optional(),
    loginBackgroundImage: z.string().max(500).nullable().optional(),
    loginBackgroundBlur: z.number().int().min(0).max(20).optional(),
    loginBackgroundDim: z.number().int().min(0).max(100).optional(),
    loginBackgroundColor: z.string().max(40).nullable().optional(),
    maintenanceMode: z.boolean().optional(),
    announcementMessage: z.string().max(500).nullable().optional(),
    announcementType: z.enum(['info', 'warning', 'success', 'error']).nullable().optional(),
}).strict();

export const resendVerificationSchema = z.object({
    email: z.string().email('Correo electrónico inválido'),
}).strict();

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

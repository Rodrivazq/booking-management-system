import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { DAY_KEYS, cloneDefaultMenuDays } from '../utils/db'; // Still need constants

import { getCurrentMonday, getNextMonday } from '../utils/dates';

export const getMenu = async (req: Request, res: Response) => {
    const currentMonday = getCurrentMonday();
    const nextMonday = getNextMonday();

    try {
        let currentMenu = await prisma.weeklyMenu.findUnique({ where: { weekStart: currentMonday } });
        let nextMenu = await prisma.weeklyMenu.findUnique({ where: { weekStart: nextMonday } });

        const response = {
            menu: {
                current: currentMenu ? { ...currentMenu, days: JSON.parse(currentMenu.days as string) } : null,
                next: nextMenu ? { ...nextMenu, days: JSON.parse(nextMenu.days as string) } : null
            },
            currentMonday,
            nextMonday
        };

        res.json(response);
    } catch (error) {
        console.error('Get menu error:', error);
        res.status(500).json({ error: 'Error al obtener menu' });
    }
};

// GET /api/menu/catalog — nombres distintos de comidas y postres ya usados en
// cualquier menú. Alimenta el autocompletado para reutilizar platos repetidos.
export const getMenuCatalog = async (_req: Request, res: Response) => {
    try {
        const menus = await prisma.weeklyMenu.findMany({ select: { days: true } });
        const meals = new Set<string>();
        const desserts = new Set<string>();

        for (const m of menus) {
            let days: any;
            try { days = JSON.parse(m.days as string); } catch { continue; }
            for (const day of DAY_KEYS) {
                const entry = days?.[day];
                if (!entry) continue;
                (Array.isArray(entry.meals) ? entry.meals : []).forEach((x: any) => {
                    const s = String(x || '').trim();
                    if (s) meals.add(s);
                });
                (Array.isArray(entry.desserts) ? entry.desserts : []).forEach((x: any) => {
                    const s = String(x || '').trim();
                    if (s) desserts.add(s);
                });
            }
        }

        res.json({
            meals: Array.from(meals).sort((a, b) => a.localeCompare(b, 'es')),
            desserts: Array.from(desserts).sort((a, b) => a.localeCompare(b, 'es')),
        });
    } catch (error) {
        console.error('Get menu catalog error:', error);
        res.status(500).json({ error: 'Error al obtener catalogo de menu' });
    }
};

export const updateMenu = async (req: Request, res: Response) => {
    const { days, type } = req.body || {};
    if (!['current', 'next'].includes(type)) return res.status(400).json({ error: 'Tipo de menu invalido (current/next)' });
    if (typeof days !== 'object' || !days) return res.status(400).json({ error: 'Debe enviar un objeto days' });

    const currentMonday = getCurrentMonday();
    const nextMonday = getNextMonday();
    const targetWeekStart = type === 'current' ? currentMonday : nextMonday;

    try {
        const menu = await prisma.weeklyMenu.findUnique({ where: { weekStart: targetWeekStart } });
        const shouldGenerateBaseMenu = Object.keys(days).length === 0;
        const sourceDays = shouldGenerateBaseMenu ? cloneDefaultMenuDays() : days;
        const normalized: any = {};

        for (const day of DAY_KEYS) {
            const entry = sourceDays[day];
            if (!entry) {
                return res.status(400).json({ error: `Falta configurar el dia ${day}` });
            }

            const meals = Array.isArray(entry.meals)
                ? entry.meals.map((m: any) => String(m || '').trim()).filter(Boolean).slice(0, 3)
                : [];
            const desserts = Array.isArray(entry.desserts)
                ? entry.desserts.map((d: any) => String(d || '').trim()).filter(Boolean).slice(0, 3)
                : [];

            if (meals.length === 0 || desserts.length === 0) {
                return res.status(400).json({ error: `Cada dia debe tener al menos 1 comida y 1 postre (${day})` });
            }

            normalized[day] = { meals, desserts };
        }

        let updatedMenu;
        if (menu) {
            updatedMenu = await prisma.weeklyMenu.update({
                where: { weekStart: targetWeekStart },
                data: { days: JSON.stringify(normalized) }
            });
        } else {
            updatedMenu = await prisma.weeklyMenu.create({
                data: {
                    weekStart: targetWeekStart,
                    days: JSON.stringify(normalized),
                    breadAvailable: true
                }
            });
        }

        // We need to return the full menu structure { current, next } because frontend expects it
        
        const otherWeekStart = type === 'current' ? nextMonday : currentMonday;
        const otherMenu = await prisma.weeklyMenu.findUnique({ where: { weekStart: otherWeekStart } });

        const response = {
            menu: {
                [type]: { ...updatedMenu, days: JSON.parse(updatedMenu.days as string) },
                [type === 'current' ? 'next' : 'current']: otherMenu ? { ...otherMenu, days: JSON.parse(otherMenu.days as string) } : null
            }
        };

        res.json(response);
    } catch (error) {
        console.error('Update menu error:', error);
        res.status(500).json({ error: 'Error al actualizar menu' });
    }
};

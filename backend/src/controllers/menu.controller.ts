import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { DAY_KEYS, cloneDefaultMenuDays } from '../utils/db'; // Still need constants

const getCurrentMonday = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString().slice(0, 10);
};

const getNextMonday = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = (8 - day) % 7 || 7;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + diff);
    nextMonday.setHours(0, 0, 0, 0);
    return nextMonday.toISOString().slice(0, 10);
};

export const getMenu = async (req: Request, res: Response) => {
    const currentMonday = getCurrentMonday();
    const nextMonday = getNextMonday();

    try {
        let currentMenu = await prisma.weeklyMenu.findUnique({ where: { weekStart: currentMonday } });
        let nextMenu = await prisma.weeklyMenu.findUnique({ where: { weekStart: nextMonday } });

        // Initialize if missing
        if (!currentMenu) {
            currentMenu = await prisma.weeklyMenu.create({
                data: {
                    weekStart: currentMonday,
                    days: JSON.stringify(cloneDefaultMenuDays()),
                    breadAvailable: true
                }
            });
        }

        if (!nextMenu) {
            nextMenu = await prisma.weeklyMenu.create({
                data: {
                    weekStart: nextMonday,
                    days: JSON.stringify(cloneDefaultMenuDays()),
                    breadAvailable: true
                }
            });
        }

        // Parse JSON for response
        const response = {
            menu: {
                current: { ...currentMenu, days: JSON.parse(currentMenu.days as string) },
                next: { ...nextMenu, days: JSON.parse(nextMenu.days as string) }
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

export const updateMenu = async (req: Request, res: Response) => {
    const { days, type } = req.body || {};
    if (!['current', 'next'].includes(type)) return res.status(400).json({ error: 'Tipo de menu invalido (current/next)' });
    if (typeof days !== 'object' || !days) return res.status(400).json({ error: 'Debe enviar un objeto days' });

    const currentMonday = getCurrentMonday();
    const nextMonday = getNextMonday();
    const targetWeekStart = type === 'current' ? currentMonday : nextMonday;

    try {
        const menu = await prisma.weeklyMenu.findUnique({ where: { weekStart: targetWeekStart } });
        if (!menu) return res.status(404).json({ error: 'Menu no encontrado' });

        const currentDays: any = JSON.parse(menu.days as string);
        const normalized: any = {};

        for (const day of DAY_KEYS) {
            const entry = days[day] || {};
            const fallback = currentDays[day] || cloneDefaultMenuDays()[day as any];

            let meals = Array.isArray(entry.meals) ? entry.meals.map((m: any) => String(m || '').trim()) : [];
            let desserts = Array.isArray(entry.desserts) ? entry.desserts.map((d: any) => String(d || '').trim()) : [];

            meals = [...meals.filter(Boolean), ...(fallback.meals || [])].slice(0, 3);
            desserts = [...desserts.filter(Boolean), ...(fallback.desserts || [])].slice(0, 3);

            if (meals.length !== 3 || desserts.length !== 3) return res.status(400).json({ error: `Cada dia debe tener 3 comidas y 3 postres (${day})` });

            normalized[day] = { meals, desserts };
        }

        const updatedMenu = await prisma.weeklyMenu.update({
            where: { weekStart: targetWeekStart },
            data: { days: JSON.stringify(normalized) }
        });

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

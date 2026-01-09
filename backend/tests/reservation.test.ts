import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/utils/prisma';
import fs from 'fs';

const getNextMonday = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = (8 - day) % 7 || 7;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + diff);
    nextMonday.setHours(0, 0, 0, 0);
    return nextMonday.toISOString().slice(0, 10);
};

describe('Reservation Endpoints', () => {
  let token: string;
  let userId: string;
  const nextMonday = getNextMonday();

  beforeEach(async () => {
    // Create a user
    const userRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Res User',
        email: 'res@example.com',
        password: 'password123',
        funcNumber: 'RES001'
      });
    
    token = userRes.body.token;
    userId = userRes.body.user.id;

    // Setup Menu for next week
    await prisma.weeklyMenu.create({
      data: {
        weekStart: nextMonday,
        days: JSON.stringify({
          lunes: { meals: ['Meal A', 'Meal B', 'Meal C'], desserts: ['Dessert A', 'Dessert B', 'Dessert C'] },
          martes: { meals: ['Meal A', 'Meal B', 'Meal C'], desserts: ['Dessert A', 'Dessert B', 'Dessert C'] },
          miercoles: { meals: ['Meal A', 'Meal B', 'Meal C'], desserts: ['Dessert A', 'Dessert B', 'Dessert C'] },
          jueves: { meals: ['Meal A', 'Meal B', 'Meal C'], desserts: ['Dessert A', 'Dessert B', 'Dessert C'] },
          viernes: { meals: ['Meal A', 'Meal B', 'Meal C'], desserts: ['Dessert A', 'Dessert B', 'Dessert C'] },
        }),
        breadAvailable: true
      }
    });

    // Ensure settings allow reservation (deadline far in future for test)
    await prisma.settings.upsert({
        where: { id: 1 },
        update: { deadlineDay: 6, deadlineTime: '23:59' }, // Saturday
        create: { deadlineDay: 6, deadlineTime: '23:59' }
    });
  });

  it('should create a reservation successfully', async () => {
    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        weekStart: nextMonday,
        timeSlot: '12:00',
        selections: [
          { day: 'lunes', meal: 'Meal A', dessert: 'Dessert A', bread: true },
          { day: 'martes', meal: 'Meal B', dessert: 'Dessert B', bread: false },
          { day: 'miercoles', meal: 'Meal C', dessert: 'Dessert C', bread: true },
          { day: 'jueves', meal: 'Meal A', dessert: 'Dessert A', bread: false },
          { day: 'viernes', meal: 'Meal B', dessert: 'Dessert B', bread: true },
        ]
      });

    if (res.statusCode !== 200) {
        fs.writeFileSync('debug_res.json', JSON.stringify(res.body, null, 2));
    }

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('ok', true);

    // Verify in DB
    const reservation = await prisma.reservation.findFirst({
      where: { userId }
    });
    expect(reservation).toBeTruthy();
    expect(reservation?.weekStart).toEqual(nextMonday);
  });

  it('should fail if menu selection is invalid', async () => {
    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        weekStart: nextMonday,
        timeSlot: '12:00',
        selections: [
          { day: 'lunes', meal: 'Invalid Meal', dessert: 'Dessert A', bread: true }, // Invalid meal
          { day: 'martes', meal: 'Meal B', dessert: 'Dessert B', bread: false },
          { day: 'miercoles', meal: 'Meal C', dessert: 'Dessert C', bread: true },
          { day: 'jueves', meal: 'Meal A', dessert: 'Dessert A', bread: false },
          { day: 'viernes', meal: 'Meal B', dessert: 'Dessert B', bread: true },
        ]
      });

    if (res.statusCode !== 400) console.log('Invalid Res Error:', JSON.stringify(res.body, null, 2));
    if (res.statusCode === 400 && !res.body.error.includes('Opcion invalida')) console.log('Unexpected Error Message:', res.body.error);

    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toContain('Opcion invalida');
  });
});

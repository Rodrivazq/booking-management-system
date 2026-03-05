import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prismaMock } from './prisma.mock';
import { createReservation } from '../src/controllers/reservation.controller';
import { getNextMonday } from '../src/utils/dates';

describe('Reservation Controller - createReservation', () => {
  const nextMonday = getNextMonday();

  it('should create a reservation successfully', async () => {
    // Setup request and response mocks
    const req = {
      user: { id: 'user-123' },
      body: {
        weekStart: nextMonday,
        timeSlot: '12:00',
        selections: [
          { day: 'lunes', meal: 'Meal A', dessert: 'Dessert A', bread: true },
          { day: 'martes', meal: 'Meal B', dessert: 'Dessert B', bread: false },
          { day: 'miercoles', meal: 'Meal A', dessert: 'Dessert A', bread: false },
          { day: 'jueves', meal: 'Meal B', dessert: 'Dessert B', bread: true },
          { day: 'viernes', meal: 'Meal A', dessert: 'Dessert A', bread: false },
        ]
      }
    } as any;

    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() } as any;

    // Prisma Mocks Validation
    prismaMock.settings.findFirst.mockResolvedValue({
      id: 1, 
      deadlineDay: 6, 
      deadlineTime: '23:59', // Saturday
      companyName: 'Test',
      logoUrl: null,
      primaryColor: null,
      secondaryColor: null,
      supportEmail: null,
      supportPhone: null,
      supportWhatsApp: null,
      announcementMessage: null,
      announcementType: null
    } as any);

    prismaMock.weeklyMenu.findUnique.mockResolvedValue({
      id: 1, weekStart: nextMonday, breadAvailable: true,
      days: JSON.stringify({
         lunes: { meals: ['Meal A'], desserts: ['Dessert A'] },
         martes: { meals: ['Meal B'], desserts: ['Dessert B'] },
         miercoles: { meals: ['Meal A'], desserts: ['Dessert A'] },
         jueves: { meals: ['Meal B'], desserts: ['Dessert B'] },
         viernes: { meals: ['Meal A'], desserts: ['Dessert A'] }
      }),
      createdAt: new Date(), updatedAt: new Date()
    } as any);

    prismaMock.reservation.findFirst.mockResolvedValue(null); // No previous res
    
    prismaMock.reservation.create.mockResolvedValue({
      id: 'res-456',
      userId: 'user-123',
      weekStart: nextMonday,
      timeSlot: '12:00',
      selections: JSON.stringify(req.body.selections),
      createdAt: new Date(),
      updatedAt: new Date()
    } as any);

    await createReservation(req, res);

    expect(prismaMock.reservation.create).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true, weekStart: nextMonday });
  });

  it('should fail if deadline has passed', async () => {
     // Setup request and response mocks
     const req = {
        user: { id: 'user-123' },
        body: { weekStart: nextMonday, timeSlot: '12:00', selections: [
          { day: 'lunes', meal: 'Meal A', dessert: 'Dessert A', bread: true },
          { day: 'martes', meal: 'Meal B', dessert: 'Dessert B', bread: false },
          { day: 'miercoles', meal: 'Meal A', dessert: 'Dessert A', bread: false },
          { day: 'jueves', meal: 'Meal B', dessert: 'Dessert B', bread: true },
          { day: 'viernes', meal: 'Meal A', dessert: 'Dessert A', bread: false },
        ] }
      } as any;
  
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() } as any;

      // Mock deadline is very strict, say it passed on Monday of previous week
      prismaMock.settings.findFirst.mockResolvedValue({
        id: 1, deadlineDay: 0, deadlineTime: '00:00', // Sometime that implies passage
        companyName: 'Test', logoUrl: null, primaryColor: null, secondaryColor: null, supportEmail: null, supportPhone: null, supportWhatsApp: null, announcementMessage: null, announcementType: null
      } as any);
  
      // Force test error logic manually if needed, or rely on internal implementation checks.
      // Since it's deterministic based on "Date.now()", mocking the system time is required for this specific test
      // Simulate system time on Wednesday but pass deadline logic directly through Mock
      vi.useFakeTimers();
      const wednesday = new Date();
      // Ensure we stay within the same expected week for the date logic test, just push time forward.
      wednesday.setHours(wednesday.getHours() + 48); // Push arbitrary time
      vi.setSystemTime(wednesday);
  
      await createReservation(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('El periodo de reservas ha cerrado') }));

      vi.useRealTimers();
  });
});

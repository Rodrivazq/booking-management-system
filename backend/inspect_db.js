
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs'); // Need bcrypt to create user
const prisma = new PrismaClient();

async function checkAndCreateUser() {
  // 1. Check existing
  const users = await prisma.user.findMany();
  console.log('Existing Users:', users.map(u => ({ email: u.email, role: u.role, func: u.funcNumber })));

  // 2. Create reliable test user if not exists
  const testEmail = 'manual_test@example.com';
  const existing = users.find(u => u.email === testEmail);

  if (!existing) {
    const hashedPassword = await bcrypt.hash('password123', 10);
    const newUser = await prisma.user.create({
      data: {
        email: testEmail,
        name: 'Manual Test User',
        passwordHash: hashedPassword,
        funcNumber: '88888',
        role: 'user'
      }
    });
    console.log('Created Manual Test User:', newUser);
  } else {
    console.log('Manual Test User already exists.');
  }
}

checkAndCreateUser()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });

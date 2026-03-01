import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const currentSettings = await prisma.settings.findFirst()
  
  if (currentSettings) {
    await prisma.settings.update({
      where: { id: currentSettings.id },
      data: {
        companyName: 'Sistema de Reservas Real Sabor',
        logoUrl: '/assets/logo_real_sabor_clean.png'
      }
    })
    console.log('✅ Settings updated to Real Sabor branding')
  } else {
    await prisma.settings.create({
      data: {
        companyName: 'Sistema de Reservas Real Sabor',
        logoUrl: '/assets/logo_real_sabor_clean.png',
        primaryColor: '#10b981',
        secondaryColor: '#3b82f6',
        deadlineDay: 4,
        deadlineTime: '23:59',
        supportEmail: 'soporte@realsabor.com',
        supportPhone: '+598 99 000 000'
      }
    })
    console.log('✅ Settings created with Real Sabor branding')
  }
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

import prisma from './src/utils/prisma';

try {
    console.log('Requiring prisma...');
    // In TS import is top-level, so we just use the imported instance
    console.log('Prisma required successfully');
    prisma.$connect()
        .then(() => {
            console.log('Connected to DB');
            return prisma.$disconnect();
        })
        .catch((e: any) => {
            console.error('Connection failed:', e);
        });
} catch (e) {
    console.error('Crash:', e);
}

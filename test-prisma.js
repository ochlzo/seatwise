const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const count = await prisma.reservedSeat.count();
    console.log("RESERVED SEATS count: ", count);
}
main().catch(console.error).finally(() => prisma.$disconnect());

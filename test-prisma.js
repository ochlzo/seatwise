async function main() {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const count = await prisma.reservedSeat.count();
    console.log("RESERVED SEATS count: ", count);

    await prisma.$disconnect();
}
main().catch(console.error);

import prisma from "./src/lib/prisma.js";

async function main() {
  const user = await prisma.user.upsert({
    where: {
      email: "buyer@workseal.test",
    },
    update: {},
    create: {
      name: "Demo Buyer",
      email: "buyer@workseal.test",
      role: "BUYER",
    },
  });

  console.log("Test user created:");
  console.log(user);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set in the .env file.");
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  const demoEmail = "demo@workseal.test";
  const demoPassword = process.env.DEMO_USER_PASSWORD;

  if (!demoPassword) {
    throw new Error(
      "DEMO_USER_PASSWORD is not set in the .env file."
    );
  }

  // Remove existing demo data so the seed is repeatable.
  await prisma.ticket.deleteMany({
    where: {
      user: {
        email: demoEmail,
      },
    },
  });

  await prisma.user.deleteMany({
    where: {
      email: demoEmail,
    },
  });

  // Create demo user.
  const user = await prisma.user.create({
    data: {
      name: "Demo User",
      email: demoEmail,
      password: demoPassword,
    },
  });

  // Create seeded tickets.
  await prisma.ticket.createMany({
    data: [
      {
        id: 101,
        subject: "Unable to login",
        description: "Customer is unable to log into their account.",
        priority: "MEDIUM",
        status: "OPEN",
        userId: user.id,
      },
      {
        id: 102,
        subject: "Payment issue",
        description: "Customer reported an issue with a payment.",
        priority: "HIGH",
        status: "RESOLVED",
        userId: user.id,
      },
      {
        id: 103,
        subject: "Account settings",
        description: "Customer needs help updating account settings.",
        priority: "LOW",
        status: "IN_PROGRESS",
        userId: user.id,
      },
    ],
  });

  console.log("Demo seed completed successfully.");
  console.log(`Demo user: ${demoEmail}`);
  console.log("Seeded tickets: 101, 102, 103");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
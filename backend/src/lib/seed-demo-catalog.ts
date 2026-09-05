import path from "node:path";
import { pathToFileURL } from "node:url";

import prisma from "./prisma.js";
import { seedValidatedDemoCatalog } from "./demo-catalog.js";

async function main(): Promise<void> {
  await seedValidatedDemoCatalog(prisma);
  console.log(
    "Persisted the validated demo catalog plans to criterion.aiInterpretation."
  );
}

if (
  import.meta.url ===
  pathToFileURL(path.resolve(process.argv[1] ?? "")).href
) {
  main().catch((error) => {
    console.error("Demo catalog seeding failed:", error);
    process.exit(1);
  });
}

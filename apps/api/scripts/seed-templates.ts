import { closeDb } from "@/db";
import { seedStartingTemplates } from "@/messages/seed";

async function main() {
  const inserted = await seedStartingTemplates();
  for (const [segment, total] of Object.entries(inserted)) {
    console.log(
      total > 0 ? `Segment ${segment}: inserted ${total} templates` : `Segment ${segment}: already has templates, skipped`,
    );
  }
  await closeDb();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import { readFileSync } from "node:fs";
import { hashPassword } from "../src/admin/auth";

async function main() {
  let password = process.argv[2];
  if (!password) {
    password = readFileSync(0, "utf-8").trim();
  }
  if (!password) {
    process.stderr.write("Error: password is required\n");
    process.exit(1);
  }
  const hash = await hashPassword(password);
  process.stdout.write(`${hash}\n`);
}

main().catch((err) => {
  process.stderr.write(`${String(err)}\n`);
  process.exit(1);
});

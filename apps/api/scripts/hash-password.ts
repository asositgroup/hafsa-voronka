import { readFileSync } from "node:fs";
import { hashPassword } from "../src/admin/auth";

function promptHidden(question: string) {
  return new Promise<string>((resolve) => {
    const stdin = process.stdin;
    process.stderr.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stderr.write("\n");
          resolve(value);
          return;
        }
        if (char === "\u0003") {
          process.stderr.write("\n");
          process.exit(130);
        }
        if (char === "\u007f") {
          value = value.slice(0, -1);
        } else {
          value += char;
        }
      }
    };
    stdin.on("data", onData);
  });
}

async function readPassword() {
  if (process.argv[2]) return process.argv[2];
  if (process.stdin.isTTY) return promptHidden("Admin password: ");
  return readFileSync(0, "utf-8").trim();
}

async function main() {
  const password = await readPassword();
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

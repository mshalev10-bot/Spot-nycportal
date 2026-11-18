import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { randomBytes, scryptSync } from "node:crypto";

const arg = process.argv[2];
let password = arg;
if (!password) {
  const rl = createInterface({ input: stdin, output: stdout });
  password = await rl.question("Password: ");
  rl.close();
}

if (!password || password.length < 10) {
  console.error("Use a password of at least 10 characters.");
  process.exit(1);
}
if (password.length > 200) {
  console.error("Password is too long.");
  process.exit(1);
}

const salt = randomBytes(16).toString("hex");
const hash = scryptSync(password, salt, 64).toString("hex");
process.stdout.write(`scrypt$${salt}$${hash}\n`);

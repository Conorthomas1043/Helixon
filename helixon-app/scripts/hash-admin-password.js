// Generates a bcrypt hash for an admin password, for the
// ADMIN_PASSWORD_HASH_<USERNAME> environment variable (see lib/admin-auth.js).
//
// Usage:  node scripts/hash-admin-password.js
// Prompts for the password without echoing it, then prints the hash. Paste
// the hash into Vercel (Project Settings > Environment Variables) - never
// the password itself. Old sha256 hashes keep working until replaced.

const bcrypt = require("bcryptjs");

const COST = 12;

function promptHidden(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    let value = "";
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    stdin.on("data", function onData(ch) {
      if (ch === "\r" || ch === "\n" || ch === "") {
        stdin.setRawMode?.(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        process.stdout.write("\n");
        resolve(value);
      } else if (ch === "") {
        process.exit(1);
      } else if (ch === "" || ch === "\b") {
        value = value.slice(0, -1);
      } else {
        value += ch;
      }
    });
  });
}

(async () => {
  const password = await promptHidden("Admin password: ");
  if (password.length < 12) {
    console.error("Use at least 12 characters.");
    process.exit(1);
  }
  const confirm = await promptHidden("Confirm password: ");
  if (password !== confirm) {
    console.error("Passwords did not match.");
    process.exit(1);
  }
  console.log("\nbcrypt hash (set as ADMIN_PASSWORD_HASH_<USERNAME>):\n");
  console.log(await bcrypt.hash(password, COST));
})();

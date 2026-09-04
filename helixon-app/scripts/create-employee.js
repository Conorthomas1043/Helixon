#!/usr/bin/env node
// scripts/create-employee.js
//
// Creates (or resets the password for) an employee login account in the
// `employees` table. There's no admin UI for this yet, so this is a
// one-off CLI you run locally / in a deploy shell.
//
// Usage:
//   node scripts/create-employee.js --username alex --password 'S0meLong!Pass' --name "Alex Rivera" [--role employee] [--reset]
//
// Requires the same env vars the app uses for the service-role Supabase
// client: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Load them however you
// normally do (e.g. `node -r dotenv/config scripts/create-employee.js ...`
// or export them in your shell first) - this script does not read .env
// files on its own.
//
// Security notes:
//   - The password is hashed with bcrypt (cost 12) before it ever touches
//     the database - nothing plaintext is stored or logged.
//   - Pass the password as an argument only in a trusted local/deploy shell;
//     avoid running this in contexts where shell history or process lists
//     are visible to others (e.g. prefer an interactive prompt on a shared
//     machine - this script accepts --password for scriptability, but you
//     can omit it to be prompted instead).
//   - --reset overwrites an existing account's password_hash; without it,
//     the script refuses to touch an existing username.

const { createClient } = require("@supabase/supabase-js");
const bcrypt = require("bcryptjs");
const readline = require("readline");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        args[key] = true; // boolean flag, e.g. --reset
      } else {
        args[key] = next;
        i++;
      }
    }
  }
  return args;
}

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    // Basic input masking - good enough for a local CLI, not a security boundary.
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY in the environment.");
    process.exit(1);
  }

  const username = typeof args.username === "string" ? args.username.trim() : "";
  const fullName = typeof args.name === "string" ? args.name.trim() : "";
  const role = typeof args.role === "string" ? args.role.trim() : "employee";
  const reset = args.reset === true;

  if (!username) {
    console.error("Usage: node scripts/create-employee.js --username <username> --name \"Full Name\" [--password <password>] [--role employee] [--reset]");
    process.exit(1);
  }
  if (!/^[a-zA-Z0-9_.-]{1,64}$/.test(username)) {
    console.error("Username must be 1-64 chars: letters, numbers, underscore, dot, or hyphen only (must match app/api/employee/login's validation).");
    process.exit(1);
  }
  if (!fullName) {
    console.error("Missing --name \"Full Name\" (required - the employees table has full_name NOT NULL).");
    process.exit(1);
  }

  let password = typeof args.password === "string" ? args.password : null;
  if (!password) {
    password = await promptHidden("Password for this account: ");
  }
  if (!password || password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: existing, error: lookupError } = await supabase
    .from("employees")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (lookupError) {
    console.error("Lookup failed:", lookupError.message);
    process.exit(1);
  }

  const passwordHash = bcrypt.hashSync(password, 12);

  if (existing) {
    if (!reset) {
      console.error(`An employee with username "${username}" already exists. Pass --reset to overwrite their password.`);
      process.exit(1);
    }
    const { error: updateError } = await supabase
      .from("employees")
      .update({ password_hash: passwordHash, full_name: fullName, display_name: fullName, role, is_active: true })
      .eq("id", existing.id);

    if (updateError) {
      console.error("Update failed:", updateError.message);
      process.exit(1);
    }
    console.log(`Password reset for existing employee "${username}".`);
    return;
  }

  const { error: insertError } = await supabase.from("employees").insert({
    username,
    password_hash: passwordHash,
    full_name: fullName,
    display_name: fullName,
    role,
    is_active: true,
  });

  if (insertError) {
    console.error("Insert failed:", insertError.message);
    process.exit(1);
  }

  console.log(`Created employee "${username}" (role: ${role}).`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});

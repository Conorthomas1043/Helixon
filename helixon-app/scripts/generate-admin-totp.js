// Generates a two-factor (TOTP) secret for an admin, for the
// ADMIN_TOTP_SECRET_<USERNAME> environment variable (see lib/admin-totp.js).
//
// Usage:  node scripts/generate-admin-totp.js <username>
//
// Then:
//   1. Add the printed secret in Vercel as ADMIN_TOTP_SECRET_<USERNAME>
//      (username upper-cased, e.g. ADMIN_TOTP_SECRET_CONOR) and redeploy.
//   2. In your authenticator app (1Password, Google Authenticator, Authy...),
//      add an account and either paste the secret or use "enter a setup key".
//   3. From then on, that admin enters the 6-digit code at sign-in.
// Keep the secret out of git and chat - anyone who has it can generate codes.

const crypto = require("crypto");

const username = (process.argv[2] || "").trim();
if (!/^[A-Za-z0-9._-]{2,64}$/.test(username)) {
  console.error("Usage: node scripts/generate-admin-totp.js <admin-username>");
  process.exit(1);
}

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Encode(buffer) {
  let bits = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i < bits.length; i += 5) out += BASE32[parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)];
  return out;
}

const secret = base32Encode(crypto.randomBytes(20)); // 160 bits, the RFC 4226 recommendation
const envName = `ADMIN_TOTP_SECRET_${username.toUpperCase()}`;
const label = encodeURIComponent(`Helixon Admin:${username}`);
const url = `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent("Helixon Admin")}&digits=6&period=30`;

console.log(`\nEnvironment variable:\n  ${envName}=${secret}\n`);
console.log(`Setup key for your authenticator app:\n  ${secret.match(/.{1,4}/g).join(" ")}\n`);
console.log(`otpauth URL (for a QR code generator, if you want one):\n  ${url}\n`);

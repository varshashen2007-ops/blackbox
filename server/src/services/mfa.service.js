import crypto from 'crypto';

/**
 * Standard RFC 6238 TOTP Implementation (HMAC-SHA1, 30s step, 6 digits)
 * Zero external dependencies — built using Node.js crypto
 */

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Generate a cryptographically secure random base32 secret for TOTP
 * @param {number} length Number of characters (default 32)
 * @returns {string} Base32 encoded secret
 */
export function generateMfaSecret(length = 32) {
  const randomBytes = crypto.randomBytes(length);
  let secret = '';
  for (let i = 0; i < length; i++) {
    secret += BASE32_CHARS[randomBytes[i] % 32];
  }
  return secret;
}

/**
 * Decode Base32 string to Buffer
 * @param {string} base32 
 * @returns {Buffer}
 */
function base32ToBuffer(base32) {
  const clean = base32.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (let i = 0; i < clean.length; i++) {
    const val = BASE32_CHARS.indexOf(clean[i]);
    bits += val.toString(2).padStart(5, '0');
  }

  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

/**
 * Generate a 6-digit TOTP code for a given secret at a specific counter
 * @param {string} secret Base32 secret
 * @param {number} counter Time counter (timestamp / 30)
 * @returns {string} 6-digit OTP
 */
export function generateTotpCode(secret, counter = Math.floor(Date.now() / 1000 / 30)) {
  const key = base32ToBuffer(secret);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', key);
  hmac.update(counterBuffer);
  const digest = hmac.digest();

  // Dynamic truncation (RFC 4226)
  const offset = digest[digest.length - 1] & 0xf;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  const otp = (binary % 1000000).toString().padStart(6, '0');
  return otp;
}

/**
 * Verify a user-supplied 6-digit TOTP code against their secret
 * Checks current time step and adjacent ±1 steps (±30 seconds) for clock drift
 * @param {string} token 6-digit code supplied by user
 * @param {string} secret Base32 secret
 * @param {number} window Window of time steps to check (default 1 = ±30s)
 * @returns {boolean} true if valid
 */
export function verifyTotpCode(token, secret, window = 1) {
  if (!token || !secret) return false;
  const cleanedToken = String(token).trim();
  if (cleanedToken.length !== 6 || !/^\d{6}$/.test(cleanedToken)) return false;

  const currentCounter = Math.floor(Date.now() / 1000 / 30);
  for (let offset = -window; offset <= window; offset++) {
    const expectedOtp = generateTotpCode(secret, currentCounter + offset);
    if (crypto.timingSafeEqual(Buffer.from(cleanedToken), Buffer.from(expectedOtp))) {
      return true;
    }
  }
  return false;
}

/**
 * Generate otpauth:// URI for authenticator apps (Google Authenticator, etc.)
 * @param {string} email User email
 * @param {string} secret Base32 secret
 * @param {string} issuer Organization / Service name
 * @returns {string} otpauth URI
 */
export function getOtpAuthUri(email, secret, issuer = 'BlackBox Forensics') {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(email);
  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

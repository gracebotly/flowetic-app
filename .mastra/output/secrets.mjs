import crypto from 'node:crypto';

const KEY_B64 = process.env.SOURCE_SECRET_ENCRYPTION_KEY_B64 || "";
const KEY = KEY_B64 ? Buffer.from(KEY_B64, "base64") : null;
function encryptSecret(plaintext) {
  if (!KEY || KEY.length !== 32) {
    throw new Error("Missing/invalid SOURCE_SECRET_ENCRYPTION_KEY_B64 (must be 32 bytes base64).");
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = {
    v: 1,
    alg: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: enc.toString("base64")
  };
  return JSON.stringify(payload);
}
function decryptSecret(ciphertext) {
  if (!KEY || KEY.length !== 32) {
    throw new Error("Missing/invalid SOURCE_SECRET_ENCRYPTION_KEY_B64 (must be 32 bytes base64).");
  }
  const payload = JSON.parse(ciphertext);
  if (payload?.v !== 1 || payload.alg !== "aes-256-gcm") {
    throw new Error("Unsupported secret envelope.");
  }
  const iv = Buffer.from(payload.iv, "base64");
  const tag = Buffer.from(payload.tag, "base64");
  const data = Buffer.from(payload.data, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString("utf8");
}

export { decryptSecret as d, encryptSecret as e };

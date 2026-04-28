import crypto from "node:crypto";

const SECRET =
  process.env.STREAMER_TOKEN_SECRET ??
  process.env.STREAMER_TOKEN ??
  "dev-secret-change-me";

const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

function hmac(payload: string): string {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
}

export function signStreamerToken(streamerId: string): string {
  const expiry = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const payload = `${streamerId}:${expiry}`;
  const sig = hmac(payload);
  return `${payload}.${sig}`;
}

export function verifyStreamerToken(token: string | undefined | null): string | null {
  if (!token || typeof token !== "string") return null;

  const lastDot = token.lastIndexOf(".");
  if (lastDot <= 0) return null;

  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  if (!payload || !sig) return null;

  const expected = hmac(payload);
  if (sig.length !== expected.length) return null;

  try {
    if (
      !crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))
    ) {
      return null;
    }
  } catch {
    return null;
  }

  const colonIdx = payload.lastIndexOf(":");
  if (colonIdx <= 0) return null;

  const streamerId = payload.slice(0, colonIdx);
  const expiry = parseInt(payload.slice(colonIdx + 1), 10);

  if (!streamerId || isNaN(expiry)) return null;

  if (Math.floor(Date.now() / 1000) > expiry) return null;

  return streamerId;
}

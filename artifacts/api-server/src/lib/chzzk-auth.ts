import crypto from "node:crypto";
import { logger } from "./logger.js"; // 라이브러리 폴더 내에 같이 있으므로 ./ 경로 사용

const ACCOUNT_INTERLOCK_URL = "https://chzzk.naver.com/account-interlock";
const OPEN_API_BASE = "https://openapi.chzzk.naver.com";

const CLIENT_ID = process.env.CHZZK_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.CHZZK_CLIENT_SECRET ?? "";
const STATE_SECRET = process.env.CHZZK_STATE_SECRET ?? process.env.STREAMER_TOKEN_SECRET ?? "dev-state-secret-change-me";
const STATE_TTL_SECONDS = 10 * 60;

export class ChzzkConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChzzkConfigError";
  }
}

export function assertChzzkConfigured(): void {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new ChzzkConfigError("치지직 OAuth 설정 누락 (CLIENT_ID/SECRET)");
  }
}

export function getRedirectUri(): string {
  const uri = process.env.CHZZK_REDIRECT_URI;
  if (!uri) throw new ChzzkConfigError("CHZZK_REDIRECT_URI 환경변수 누락");
  return uri;
}

function hmac(payload: string): string {
  return crypto.createHmac("sha256", STATE_SECRET).update(payload).digest("hex");
}

export function createOAuthState(returnTo: string): { nonce: string; cookie: string } {
  const nonce = crypto.randomBytes(16).toString("hex");
  const exp = Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS;
  const payload = JSON.stringify({ nonce, returnTo: returnTo.split("#")[0] || "/", exp });
  const encoded = Buffer.from(payload, "utf8").toString("base64url");
  const sig = hmac(encoded);
  return { nonce, cookie: `${encoded}.${sig}` };
}

export function verifyOAuthState(cookieValue: string | undefined, expectedNonce: string): any | null {
  if (!cookieValue || typeof cookieValue !== "string") return null;
  const lastDot = cookieValue.lastIndexOf(".");
  if (lastDot <= 0) return null;
  const encoded = cookieValue.slice(0, lastDot);
  const sig = cookieValue.slice(lastDot + 1);
  if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(hmac(encoded), "hex"))) return null;
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  if (payload.nonce !== expectedNonce || Math.floor(Date.now() / 1000) > payload.exp) return null;
  return payload;
}

export function sanitizeReturnTo(input: string | undefined | null): string {
  if (!input || typeof input !== "string" || !input.startsWith("/") || input.startsWith("//")) return "/";
  return input.split("#")[0] || "/";
}

export function buildAuthorizeUrl(nonce: string): string {
  assertChzzkConfigured();
  return `${ACCOUNT_INTERLOCK_URL}?clientId=${CLIENT_ID}&redirectUri=${encodeURIComponent(getRedirectUri())}&state=${nonce}`;
}

export async function exchangeCodeForToken(code: string, state: string): Promise<any> {
  assertChzzkConfigured();
  const res: any = await fetch(`${OPEN_API_BASE}/auth/v1/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grantType: "authorization_code", clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, code, state }),
  });
  const json = await res.json();
  return json.content;
}

export async function fetchUserMe(accessToken: string): Promise<any> {
  const res: any = await fetch(`${OPEN_API_BASE}/open/v1/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  const json = await res.json();
  return json.content;
}

export async function fetchChannelInfo(channelId: string): Promise<any> {
  const url = `${OPEN_API_BASE}/open/v1/channels?channelIds=${channelId}`;
  const res: any = await fetch(url, {
    headers: { "Client-Id": CLIENT_ID, "Client-Secret": CLIENT_SECRET },
  });
  const json = await res.json();
  return json?.content?.data?.[0] || null;
}

export const CHZZK_OAUTH_STATE_COOKIE = "chzzk_oauth_state";

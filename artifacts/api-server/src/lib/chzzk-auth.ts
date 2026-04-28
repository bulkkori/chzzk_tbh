import crypto from "node:crypto";
import { logger } from "./logger";

// ---------------------------------------------------------------------------
// Official Chzzk Open API (https://chzzk.gitbook.io/chzzk).
//
// We use the OAuth 2.0 authorization code flow:
//
//   1. Send the user to https://chzzk.naver.com/account-interlock with our
//      clientId, redirectUri, and a state nonce.
//   2. Chzzk redirects back to redirectUri with `code` and `state`.
//   3. Exchange the code for an access token at /auth/v1/token.
//   4. Use the access token to call /open/v1/users/me.
//
// The previous implementation relied on kimcore/chzzk, which scraped
// undocumented internal endpoints using the user's Naver session cookies.
// That approach is fragile and asks streamers to hand over login cookies.
// The official OAuth flow is the supported path.
// ---------------------------------------------------------------------------

const ACCOUNT_INTERLOCK_URL = "https://chzzk.naver.com/account-interlock";
const OPEN_API_BASE = "https://openapi.chzzk.naver.com";

const CLIENT_ID = process.env.CHZZK_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.CHZZK_CLIENT_SECRET ?? "";

const STATE_SECRET =
  process.env.CHZZK_STATE_SECRET ??
  process.env.STREAMER_TOKEN_SECRET ??
  "dev-state-secret-change-me";

const STATE_TTL_SECONDS = 10 * 60; // 10 minutes — enough to log in, not enough to replay later.

export class ChzzkConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChzzkConfigError";
  }
}

export function assertChzzkConfigured(): void {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new ChzzkConfigError(
      "치지직 OAuth 설정이 되어 있지 않아요. CHZZK_CLIENT_ID와 CHZZK_CLIENT_SECRET 시크릿을 설정해 주세요.",
    );
  }
}

/** The redirect URI we register with chzzk. Must match the one in the chzzk
 * developer console exactly. */
export function getRedirectUri(): string {
  const uri = process.env.CHZZK_REDIRECT_URI;
  if (!uri) {
    throw new ChzzkConfigError(
      "CHZZK_REDIRECT_URI 환경변수를 설정해 주세요. " +
      "예: https://your-api.vercel.app/api/auth/chzzk/callback",
    );
  }
  return uri;
}

// ---------------------------------------------------------------------------
// State signing — used to bind the `state` query param back to the original
// request so attackers can't forge a callback with a different account's code.
// We pack `{nonce, returnTo, expiry}` into a signed cookie and put just the
// nonce in the chzzk `state` query param. On callback, we verify the cookie
// and that the nonce in `state` matches the one in the cookie.
// ---------------------------------------------------------------------------

function hmac(payload: string): string {
  return crypto.createHmac("sha256", STATE_SECRET).update(payload).digest("hex");
}

export interface OAuthStatePayload {
  nonce: string;
  returnTo: string;
  exp: number;
}

export function createOAuthState(returnTo: string): {
  nonce: string;
  cookie: string;
} {
  const nonce = crypto.randomBytes(16).toString("hex");
  const exp = Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS;
  const safeReturn = sanitizeReturnTo(returnTo);
  const payload = JSON.stringify({ nonce, returnTo: safeReturn, exp });
  const encoded = Buffer.from(payload, "utf8").toString("base64url");
  const sig = hmac(encoded);
  return { nonce, cookie: `${encoded}.${sig}` };
}

export function verifyOAuthState(
  cookieValue: string | undefined,
  expectedNonce: string,
): OAuthStatePayload | null {
  if (!cookieValue || typeof cookieValue !== "string") return null;
  const lastDot = cookieValue.lastIndexOf(".");
  if (lastDot <= 0) return null;
  const encoded = cookieValue.slice(0, lastDot);
  const sig = cookieValue.slice(lastDot + 1);
  const expected = hmac(encoded);
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
  let payload: OAuthStatePayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!payload || typeof payload.nonce !== "string") return null;
  if (payload.nonce !== expectedNonce) return null;
  if (typeof payload.exp !== "number" || Math.floor(Date.now() / 1000) > payload.exp) {
    return null;
  }
  return payload;
}

function sanitizeReturnTo(input: string | undefined | null): string {
  if (!input) return "/";
  // Only allow same-origin paths — must start with "/" and not "//".
  if (typeof input !== "string") return "/";
  if (!input.startsWith("/") || input.startsWith("//")) return "/";
  // Strip any fragment to keep our own out of the URL.
  return input.split("#")[0] || "/";
}

export { sanitizeReturnTo };

// ---------------------------------------------------------------------------
// Authorization URL
// ---------------------------------------------------------------------------

export function buildAuthorizeUrl(nonce: string): string {
  assertChzzkConfigured();
  const params = new URLSearchParams({
    clientId: CLIENT_ID,
    redirectUri: getRedirectUri(),
    state: nonce,
  });
  return `${ACCOUNT_INTERLOCK_URL}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Token exchange
// ---------------------------------------------------------------------------

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: string | number;
}

export async function exchangeCodeForToken(
  code: string,
  state: string,
): Promise<TokenResponse> {
  assertChzzkConfigured();
  const res = await fetch(`${OPEN_API_BASE}/auth/v1/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      grantType: "authorization_code",
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      code,
      state,
    }),
  });
  const json = (await res.json().catch(() => null)) as
    | { code?: number; message?: string | null; content?: TokenResponse }
    | null;
  if (!res.ok || !json || !json.content?.accessToken) {
    logger.warn(
      { status: res.status, body: json },
      "chzzk token exchange failed",
    );
    throw new Error(
      json?.message ?? "치지직 토큰 발급에 실패했어요. 잠시 후 다시 시도해 주세요.",
    );
  }
  return json.content;
}

// ---------------------------------------------------------------------------
// User & channel lookup
// ---------------------------------------------------------------------------

export interface ChzzkUser {
  channelId: string;
  channelName: string;
}

export async function fetchUserMe(accessToken: string): Promise<ChzzkUser> {
  const res = await fetch(`${OPEN_API_BASE}/open/v1/users/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  const json = (await res.json().catch(() => null)) as
    | { code?: number; message?: string | null; content?: ChzzkUser }
    | null;
  if (!res.ok || !json?.content?.channelId) {
    logger.warn({ status: res.status, body: json }, "chzzk users/me failed");
    throw new Error(json?.message ?? "치지직 유저 정보를 불러오지 못했어요.");
  }
  return json.content;
}

export interface ChzzkChannel {
  channelId: string;
  channelName: string;
  channelImageUrl: string | null;
}

/**
 * Fetch public channel info (name + profile image). Uses Client-Id /
 * Client-Secret headers, not the user access token. Returns `null` when the
 * lookup fails so callers can fall back to defaults from /users/me.
 */
export async function fetchChannelInfo(
  channelId: string,
): Promise<ChzzkChannel | null> {
  if (!CLIENT_ID || !CLIENT_SECRET) return null;
  try {
    const url = new URL(`${OPEN_API_BASE}/open/v1/channels`);
    url.searchParams.set("channelIds", channelId);
    const res = await fetch(url.toString(), {
      headers: {
        "Client-Id": CLIENT_ID,
        "Client-Secret": CLIENT_SECRET,
        Accept: "application/json",
      },
    });
    const json = (await res.json().catch(() => null)) as
      | {
          code?: number;
          message?: string | null;
          content?: { data?: ChzzkChannel[] };
        }
      | null;
    if (!res.ok || !json?.content?.data?.length) {
      logger.warn({ status: res.status, body: json, channelId }, "chzzk channels lookup failed");
      return null;
    }
    return json.content.data[0];
  } catch (err) {
    logger.warn({ err, channelId }, "chzzk channels lookup threw");
    return null;
  }
}

export const CHZZK_OAUTH_STATE_COOKIE = "chzzk_oauth_state";

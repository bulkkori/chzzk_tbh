import crypto from "node:crypto";
import { logger } from "./logger.js"; // .js 확장자 추가

// ---------------------------------------------------------------------------
// Official Chzzk Open API (https://chzzk.gitbook.io/chzzk).
// ---------------------------------------------------------------------------

const ACCOUNT_INTERLOCK_URL = "https://chzzk.naver.com/account-interlock";
const OPEN_API_BASE = "https://openapi.chzzk.naver.com";

const CLIENT_ID = process.env.CHZZK_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.CHZZK_CLIENT_SECRET ?? "";

const STATE_SECRET =
  process.env.CHZZK_STATE_SECRET ??
  process.env.STREAMER_TOKEN_SECRET ??
  "dev-state-secret-change-me";

const STATE_TTL_SECONDS = 10 * 60; // 10 minutes

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

/** Chzzk 개발자 콘솔에 등록한 리다이렉트 URI와 정확히 일치해야 합니다. */
export function getRedirectUri(): string {
  const uri = process.env.CHZZK_REDIRECT_URI;
  if (!uri) {
    throw new ChzzkConfigError(
      "CHZZK_REDIRECT_URI 환경변수를 설정해 주세요. 예: https://your-api.vercel.app/api/auth/chzzk/callback",
    );
  }
  return uri;
}

// ---------------------------------------------------------------------------
// State 서명 및 검증 로직
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
  if (typeof input !== "string") return "/";
  if (!input.startsWith("/") || input.startsWith("//")) return "/";
  return input.split("#")[0] || "/";
}

export { sanitizeReturnTo };

// ---------------------------------------------------------------------------
// Authorization URL 생성
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
// 토큰 교환 (Token Exchange)
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
  // fetch 결과 타입을 any로 캐스팅하여 타입 충돌 방지
  const res: any = await fetch(`${OPEN_API_BASE}/auth/v1/token`, {
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
  const json = (await res.json().catch(() => null)) as any;
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
// 유저 및 채널 정보 조회
// ---------------------------------------------------------------------------

export interface ChzzkUser {
  channelId: string;
  channelName: string;
}

export async function fetchUserMe(accessToken: string): Promise<ChzzkUser> {
  // fetch 결과 타입을 any로 캐스팅
  const res: any = await fetch(`${OPEN_API_BASE}/open/v1/users/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  const json = (await res.json().catch(() => null)) as any;
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
 * 공개 채널 정보(이름 + 프로필 이미지)를 가져옵니다.
 */
export async function fetchChannelInfo(
  channelId: string,
): Promise<ChzzkChannel | null> {
  if (!CLIENT_ID || !CLIENT_SECRET) return null;
  try {
    const url = new URL(`${OPEN_API_BASE}/open/v1/channels`);
    url.searchParams.set("channelIds", channelId);
    // fetch 결과 타입을 any로 캐스팅
    const res: any = await fetch(url.toString(), {
      headers: {
        "Client-Id": CLIENT_ID,
        "Client-Secret": CLIENT_SECRET,
        Accept: "application/json",
      },
    });
    const json = (await res.json().catch(() => null)) as any;
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

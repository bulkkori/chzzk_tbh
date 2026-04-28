import { Router } from "express";
import cookieParser from "cookie-parser";
// 1. DB 모듈을 통째로 가져와 any 처리하여 타입 충돌 방지
import * as dbModule from "@workspace/db";
const { db, streamersTable } = dbModule as any;
import { eq } from "drizzle-orm";
// 2. 로컬 파일 임포트에 .js 확장자 추가 (ESM 규칙)
import {
  CHZZK_OAUTH_STATE_COOKIE,
  ChzzkConfigError,
  buildAuthorizeUrl,
  createOAuthState,
  exchangeCodeForToken,
  fetchChannelInfo,
  fetchUserMe,
  sanitizeReturnTo,
  verifyOAuthState,
} from "../lib/chzzk-auth.js";
import { signStreamerToken } from "../lib/streamer-token.js";
import { logger } from "../lib/logger.js";

const router = Router();

// Express 5 타입 호환성을 위해 (router as any) 사용
(router as any).use(cookieParser());

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  maxAge: 10 * 60 * 1000,
  path: "/api/auth/chzzk",
};

function frontendCallbackUrl(returnTo: string, params: URLSearchParams): string {
  params.set("returnTo", returnTo);
  return `/auth/callback#${params.toString()}`;
}

// GET /api/auth/chzzk/start
(router as any).get("/auth/chzzk/start", (req: any, res: any) => {
  try {
    const returnTo = sanitizeReturnTo(
      typeof req.query.returnTo === "string" ? req.query.returnTo : "/",
    );
    const { nonce, cookie } = createOAuthState(returnTo);
    res.cookie(CHZZK_OAUTH_STATE_COOKIE, cookie, COOKIE_OPTIONS);
    return res.redirect(302, buildAuthorizeUrl(nonce));
  } catch (err: any) { // err: any 처리
    if (err instanceof ChzzkConfigError) {
      logger.error({ err }, "chzzk oauth not configured");
      return res
        .status(500)
        .send(`<pre>${escapeHtml(err.message)}</pre>`);
    }
    logger.error({ err }, "chzzk oauth start failed");
    return res
      .status(500)
      .send("<pre>치지직 로그인을 시작하지 못했어요.</pre>");
  }
});

// GET /api/auth/chzzk/callback
(router as any).get("/auth/chzzk/callback", async (req: any, res: any) => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const cookieValue = req.cookies?.[CHZZK_OAUTH_STATE_COOKIE];

  res.clearCookie(CHZZK_OAUTH_STATE_COOKIE, { path: COOKIE_OPTIONS.path });

  const verified = verifyOAuthState(cookieValue, state);
  if (!code || !state || !verified) {
    logger.warn(
      { hasCode: !!code, hasState: !!state, hasCookie: !!cookieValue },
      "chzzk oauth callback failed state check",
    );
    return res.redirect(
      302,
      frontendCallbackUrl(
        "/",
        new URLSearchParams({
          error: "치지직 로그인 요청이 만료되었거나 유효하지 않아요. 다시 시도해 주세요.",
        }),
      ),
    );
  }

  try {
    const tokenRes = await exchangeCodeForToken(code, state);
    const me = await fetchUserMe(tokenRes.accessToken);

    // 허용된 채널 ID 체크 (운영자 계정 등)
    const ALLOWED_CHANNEL_IDS = ["6ab86891e07489743437594c6e4dbf3a"];
    if (!ALLOWED_CHANNEL_IDS.includes(me.channelId)) {
      return res.redirect(
        302,
        frontendCallbackUrl(
          "/",
          new URLSearchParams({
            error: "현재 신규 등록은 준비 중입니다.",
          }),
        ),
      );
    }

    const channel = await fetchChannelInfo(me.channelId);
    const displayName = channel?.channelName || me.channelName;
    const profileImageUrl = channel?.channelImageUrl ?? null;

    // DB 쿼리 시 (db as any)를 사용하여 타입 불일치 해결
    const [existing] = await (db as any)
      .select()
      .from(streamersTable)
      .where(eq(streamersTable.channelId, me.channelId))
      .limit(1);

    let streamer;
    if (!existing) {
      const [created] = await (db as any)
        .insert(streamersTable)
        .values({
          channelId: me.channelId,
          name: displayName,
          profileImageUrl,
        })
        .returning();
      streamer = created;
    } else {
      const shouldUpdate =
        existing.name !== displayName ||
        existing.profileImageUrl !== profileImageUrl;
      if (shouldUpdate) {
        const [updated] = await (db as any)
          .update(streamersTable)
          .set({ name: displayName, profileImageUrl })
          .where(eq(streamersTable.id, existing.id))
          .returning();
        streamer = updated;
      } else {
        streamer = existing;
      }
    }

    const adminToken = signStreamerToken(streamer.id);

    return res.redirect(
      302,
      frontendCallbackUrl(
        verified.returnTo,
        new URLSearchParams({
          token: adminToken,
          channelId: streamer.channelId,
          streamerName: streamer.name,
          nickname: me.channelName,
          hasCredentials: streamer.username && streamer.passwordHash ? "1" : "0",
          isNew: existing ? "0" : "1",
        }),
      ),
    );
  } catch (err: any) {
    logger.error({ err }, "chzzk oauth callback failed");
    const message = err instanceof Error ? err.message : "치지직 로그인 처리 중 문제가 생겼어요.";
    return res.redirect(
      302,
      frontendCallbackUrl(
        verified.returnTo,
        new URLSearchParams({ error: message }),
      ),
    );
  }
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default router;

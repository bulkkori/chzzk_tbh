import { Router } from "express";
import cookieParser from "cookie-parser";
import * as dbModule from "@workspace/db";
const { db, streamersTable } = dbModule as any;
import { eq } from "drizzle-orm";

// 중요: 라우터 폴더(src/routes)에서 라이브러리 폴더(src/lib)로 접근하므로 ../lib/ 경로 사용
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

// Express 5 호환성 및 타입 에러 방지
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

(router as any).get("/auth/chzzk/start", (req: any, res: any) => {
  try {
    const returnTo = sanitizeReturnTo(
      typeof req.query.returnTo === "string" ? req.query.returnTo : "/",
    );
    const { nonce, cookie } = createOAuthState(returnTo);
    res.cookie(CHZZK_OAUTH_STATE_COOKIE, cookie, COOKIE_OPTIONS);
    return res.redirect(302, buildAuthorizeUrl(nonce));
  } catch (err: any) {
    if (err instanceof ChzzkConfigError) {
      logger.error({ err }, "chzzk oauth not configured");
      return res.status(500).send(`<pre>${err.message}</pre>`);
    }
    logger.error({ err }, "chzzk oauth start failed");
    return res.status(500).send("<pre>치지직 로그인을 시작하지 못했어요.</pre>");
  }
});

(router as any).get("/auth/chzzk/callback", async (req: any, res: any) => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const cookieValue = req.cookies?.[CHZZK_OAUTH_STATE_COOKIE];

  res.clearCookie(CHZZK_OAUTH_STATE_COOKIE, { path: COOKIE_OPTIONS.path });

  const verified = verifyOAuthState(cookieValue, state);
  if (!code || !state || !verified) {
    return res.redirect(302, frontendCallbackUrl("/", new URLSearchParams({ error: "유효하지 않은 요청입니다." })));
  }

  try {
    const tokenRes = await exchangeCodeForToken(code, state);
    const me = await fetchUserMe(tokenRes.accessToken);

    const ALLOWED_CHANNEL_IDS = ["6ab86891e07489743437594c6e4dbf3a"];
    if (!ALLOWED_CHANNEL_IDS.includes(me.channelId)) {
      return res.redirect(302, frontendCallbackUrl("/", new URLSearchParams({ error: "등록되지 않은 채널입니다." })));
    }

    const channel = await fetchChannelInfo(me.channelId);
    const displayName = channel?.channelName || me.channelName;
    const profileImageUrl = channel?.channelImageUrl ?? null;

    const [existing] = await (db as any).select().from(streamersTable).where(eq(streamersTable.channelId, me.channelId)).limit(1);

    let streamer;
    if (!existing) {
      const [created] = await (db as any).insert(streamersTable).values({ channelId: me.channelId, name: displayName, profileImageUrl }).returning();
      streamer = created;
    } else {
      const [updated] = await (db as any).update(streamersTable).set({ name: displayName, profileImageUrl }).where(eq(streamersTable.id, existing.id)).returning();
      streamer = updated;
    }

    const adminToken = signStreamerToken(streamer.id);
    return res.redirect(302, frontendCallbackUrl(verified.returnTo, new URLSearchParams({
      token: adminToken,
      channelId: streamer.channelId,
      streamerName: streamer.name,
      hasCredentials: streamer.username && streamer.passwordHash ? "1" : "0",
    })));
  } catch (err: any) {
    logger.error({ err }, "chzzk oauth callback failed");
    return res.redirect(302, frontendCallbackUrl("/", new URLSearchParams({ error: "로그인 처리 중 오류가 발생했습니다." })));
  }
});

export default router;

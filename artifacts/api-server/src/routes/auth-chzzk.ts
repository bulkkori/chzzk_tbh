import { Router } from "express";
import cookieParser from "cookie-parser";
// @workspace 별칭 사용
import * as dbModule from "@workspace/db";
const { db, streamersTable } = dbModule as any;
import { eq } from "drizzle-orm";
// 내부 lib 경로는 상대경로 + .js 유지
import { 
  createOAuthState, 
  buildAuthorizeUrl, 
  sanitizeReturnTo, 
  verifyOAuthState, 
  exchangeCodeForToken, 
  fetchUserMe, 
  fetchChannelInfo, 
  CHZZK_OAUTH_STATE_COOKIE 
} from "../lib/chzzk-auth.js";
import { signStreamerToken } from "../lib/streamer-token.js";
import { logger } from "../lib/logger.js";

const router = Router();
(router as any).use(cookieParser());

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  maxAge: 10 * 60 * 1000, // 10분
  path: "/api/auth/chzzk",
};

// 치지직 로그인 시작
(router as any).get("/auth/chzzk/start", (req: any, res: any) => {
  const returnTo = sanitizeReturnTo(req.query.returnTo as string);
  const { nonce, cookie } = createOAuthState(returnTo);
  res.cookie(CHZZK_OAUTH_STATE_COOKIE, cookie, COOKIE_OPTIONS);
  return res.redirect(302, buildAuthorizeUrl(nonce));
});

// 치지직 콜백 처리
(router as any).get("/auth/chzzk/callback", async (req: any, res: any) => {
  const code = req.query.code as string;
  const state = req.query.state as string;
  const cookieValue = req.cookies[CHZZK_OAUTH_STATE_COOKIE];

  res.clearCookie(CHZZK_OAUTH_STATE_COOKIE, { path: COOKIE_OPTIONS.path });

  const verified = verifyOAuthState(cookieValue, state);
  if (!code || !verified) {
    return res.status(400).send("Invalid OAuth state or code");
  }

  try {
    const tokenRes = await exchangeCodeForToken(code, state);
    const me = await fetchUserMe(tokenRes.accessToken);
    const channel = await fetchChannelInfo(me.channelId);

    // 스트리머 정보 저장 또는 업데이트
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
          name: channel?.channelName || me.channelName,
          profileImageUrl: channel?.channelImageUrl,
        })
        .returning();
      streamer = created;
    } else {
      const [updated] = await (db as any)
        .update(streamersTable)
        .set({
          name: channel?.channelName || me.channelName,
          profileImageUrl: channel?.channelImageUrl,
        })
        .where(eq(streamersTable.id, existing.id))
        .returning();
      streamer = updated;
    }

    const adminToken = signStreamerToken(streamer.id);
    // 프론트엔드로 리다이렉트 (프론트엔드 URL 확인 필요)
    const frontendUrl = process.env.NODE_ENV === "production" 
      ? `https://${req.headers.host?.replace("api-server", "confession-board")}` 
      : "http://localhost:5173";

    return res.redirect(`${frontendUrl}/auth/callback?token=${adminToken}`);
  } catch (err) {
    logger.error({ err }, "Chzzk login failed");
    return res.status(500).send("Login failed");
  }
});

export default router;

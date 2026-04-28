import { Router, type IRouter, type Request, type Response } from "express";
import cookieParser from "cookie-parser";
import { db, streamersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
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
} from "../lib/chzzk-auth";
import { signStreamerToken } from "../lib/streamer-token";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.use(cookieParser());

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  maxAge: 10 * 60 * 1000, // 10 minutes — matches the state TTL
  path: "/api/auth/chzzk",
};

function frontendCallbackUrl(returnTo: string, params: URLSearchParams): string {
  // The SPA is served from the same origin at "/", so we keep this relative.
  // The returnTo path lives in the hash so it survives client-side routing
  // and isn't logged in any HTTP access logs.
  params.set("returnTo", returnTo);
  return `/auth/callback#${params.toString()}`;
}

// GET /api/auth/chzzk/start?returnTo=/s/abc/admin
//   → sets the signed state cookie and redirects to the chzzk authorize page.
router.get("/auth/chzzk/start", (req: Request, res: Response) => {
  try {
    const returnTo = sanitizeReturnTo(
      typeof req.query.returnTo === "string" ? req.query.returnTo : "/",
    );
    const { nonce, cookie } = createOAuthState(returnTo);
    res.cookie(CHZZK_OAUTH_STATE_COOKIE, cookie, COOKIE_OPTIONS);
    return res.redirect(302, buildAuthorizeUrl(nonce));
  } catch (err) {
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

// GET /api/auth/chzzk/callback?code=...&state=...
//   → verifies state, exchanges the code, upserts the streamer, and redirects
//     back to the SPA at /auth/callback#token=...&channelId=...&...
router.get("/auth/chzzk/callback", async (req: Request, res: Response) => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const cookieValue = req.cookies?.[CHZZK_OAUTH_STATE_COOKIE];

  // Always clear the cookie — it should never be reused.
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

    // Upsert: insert if missing, otherwise refresh name + image so the
    // streamer's avatar stays in sync with chzzk.
    const [existing] = await db
      .select()
      .from(streamersTable)
      .where(eq(streamersTable.channelId, me.channelId))
      .limit(1);

    let streamer;
    if (!existing) {
      const [created] = await db
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
        const [updated] = await db
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
  } catch (err) {
    logger.error({ err }, "chzzk oauth callback failed");
    const message =
      err instanceof Error
        ? err.message
        : "치지직 로그인 처리 중 문제가 생겼어요.";
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

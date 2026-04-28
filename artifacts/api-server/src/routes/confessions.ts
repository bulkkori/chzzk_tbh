import { Router, type IRouter, type Request, type Response } from "express";
import { db, confessionsTable, streamersTable } from "@workspace/db";
import { and, desc, eq, isNotNull, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import {
  CreateConfessionBody,
  DeleteConfessionBody,
  UpdateConfessionBody,
  UpdateConfessionParams,
  UnlockConfessionBody,
  UnlockConfessionParams,
  AnswerConfessionBody,
  ListConfessionsQueryParams,
  ListPrivateConfessionsQueryParams,
  ListAllConfessionsQueryParams,
  GetConfessionParams,
  DeleteConfessionParams,
  AnswerConfessionParams,
  SetConfessionVerdictParams,
  SetConfessionVerdictBody,
  StreamerLoginBody,
  SetStreamerCredentialsBody,
} from "@workspace/api-zod";
import { signStreamerToken, verifyStreamerToken } from "../lib/streamer-token";

const router: IRouter = Router();

type Row = typeof confessionsTable.$inferSelect;
type StreamerRow = typeof streamersTable.$inferSelect;

function toPreview(row: Row) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    category: row.category,
    hasAnswer: !!row.answer || !!row.verdict,
    isHidden: row.isPrivate,
    verdict: (row.verdict as "guilty" | "innocent" | "funny" | null) ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function toFull(row: Row) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    category: row.category,
    answer: row.answer,
    isPrivate: row.isPrivate,
    isHidden: row.isPrivate,
    verdict: (row.verdict as "guilty" | "innocent" | "funny" | null) ?? null,
    createdAt: row.createdAt.toISOString(),
    answeredAt: row.answeredAt ? row.answeredAt.toISOString() : null,
  };
}

function toStreamerSummary(s: StreamerRow) {
  return {
    id: s.id,
    channelId: s.channelId,
    name: s.name,
    profileImageUrl: s.profileImageUrl,
    confessionCount: 0,
    hasCredentials: !!s.username && !!s.passwordHash,
    createdAt: s.createdAt.toISOString(),
  };
}

// Resolve a streamer from the URL :channelId param. Sends 404 itself if not
// found and returns null in that case.
async function resolveStreamer(
  req: Request,
  res: Response,
): Promise<StreamerRow | null> {
  const channelId = req.params.channelId;
  if (!channelId) {
    res.status(404).json({ message: "스트리머를 찾을 수 없어요." });
    return null;
  }
  const [row] = await db
    .select()
    .from(streamersTable)
    .where(eq(streamersTable.channelId, channelId))
    .limit(1);
  if (!row) {
    res.status(404).json({ message: "스트리머를 찾을 수 없어요." });
    return null;
  }
  return row;
}

function isStreamerAdmin(token: string | undefined, streamerId: string): boolean {
  const tokenStreamerId = verifyStreamerToken(token);
  return !!tokenStreamerId && tokenStreamerId === streamerId;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

// POST /auth/streamer/login — per-streamer username/password login.
// Each streamer can set their own credentials (see /auth/streamer/credentials)
// after their first chzzk login, then log in with just an id/password from then
// on — no more naver cookies passing through our server.
router.post("/auth/streamer/login", async (req: Request, res: Response) => {
  const parsed = StreamerLoginBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "입력값을 확인해 주세요." });
  }
  const username = parsed.data.username.trim().toLowerCase();
  const password = parsed.data.password;
  const [streamer] = await db
    .select()
    .from(streamersTable)
    .where(eq(streamersTable.username, username))
    .limit(1);
  if (!streamer || !streamer.passwordHash) {
    // Hash a dummy value to keep the timing roughly constant whether the
    // username exists or not.
    await bcrypt.compare(password, "$2a$10$0000000000000000000000.invalidhash000000000000000000");
    return res
      .status(401)
      .json({ message: "아이디 또는 비밀번호가 올바르지 않아요." });
  }
  const ok = await bcrypt.compare(password, streamer.passwordHash);
  if (!ok) {
    return res
      .status(401)
      .json({ message: "아이디 또는 비밀번호가 올바르지 않아요." });
  }
  return res.json({
    token: signStreamerToken(streamer.id),
    streamer: toStreamerSummary(streamer),
  });
});

// POST /auth/streamer/credentials — set or update the streamer's id/password.
// Caller must already hold a valid admin token for the streamer (obtained via
// chzzk login). Once this succeeds, the user no longer needs to keep their
// naver cookies around — they can log back in with just username/password.
router.post(
  "/auth/streamer/credentials",
  async (req: Request, res: Response) => {
    const parsed = SetStreamerCredentialsBody.safeParse(req.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return res.status(400).json({
        message:
          issue?.message ??
          "아이디는 영문/숫자 3~32자, 비밀번호는 6~64자로 입력해 주세요.",
      });
    }
    const tokenStreamerId = verifyStreamerToken(parsed.data.token);
    if (!tokenStreamerId) {
      return res
        .status(401)
        .json({ message: "토큰이 만료되었거나 잘못되었어요. 다시 로그인해 주세요." });
    }
    const username = parsed.data.username.trim().toLowerCase();
    // Check the username is free (or already owned by this streamer).
    const [conflict] = await db
      .select({ id: streamersTable.id })
      .from(streamersTable)
      .where(eq(streamersTable.username, username))
      .limit(1);
    if (conflict && conflict.id !== tokenStreamerId) {
      return res
        .status(409)
        .json({ message: "이미 사용 중인 아이디예요. 다른 아이디를 골라주세요." });
    }
    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const [updated] = await db
      .update(streamersTable)
      .set({ username, passwordHash })
      .where(eq(streamersTable.id, tokenStreamerId))
      .returning();
    if (!updated) {
      return res
        .status(404)
        .json({ message: "스트리머를 찾을 수 없어요." });
    }
    return res.json({
      token: signStreamerToken(updated.id),
      streamer: toStreamerSummary(updated),
    });
  },
);

// Note: chzzk-based login lives in routes/auth-chzzk.ts now — it uses the
// official OAuth flow with browser redirects, not a JSON POST.

// ---------------------------------------------------------------------------
// Confessions, scoped per streamer
// ---------------------------------------------------------------------------

// GET /streamers/:channelId/confessions/stats
router.get(
  "/streamers/:channelId/confessions/stats",
  async (req, res) => {
    const streamer = await resolveStreamer(req, res);
    if (!streamer) return;
    const all = await db
      .select()
      .from(confessionsTable)
      .where(eq(confessionsTable.streamerId, streamer.id));
    const total = all.length;
    const healed = all.filter((c) => !!c.answer || !!c.verdict).length;
    const waiting = total - healed;
    const counts = new Map<string, number>();
    for (const c of all) counts.set(c.category, (counts.get(c.category) ?? 0) + 1);
    const byCategory = Array.from(counts.entries()).map(
      ([category, count]) => ({ category, count }),
    );
    return res.json({ total, healed, waiting, byCategory });
  },
);

// GET /streamers/:channelId/confessions/healed
router.get(
  "/streamers/:channelId/confessions/healed",
  async (req, res) => {
    const streamer = await resolveStreamer(req, res);
    if (!streamer) return;
    const rows = await db
      .select()
      .from(confessionsTable)
      .where(
        and(
          eq(confessionsTable.streamerId, streamer.id),
          eq(confessionsTable.isPrivate, false),
          or(
            isNotNull(confessionsTable.answer),
            isNotNull(confessionsTable.verdict),
          ),
        ),
      )
      .orderBy(desc(confessionsTable.answeredAt))
      .limit(10);
    return res.json(rows.map(toPreview));
  },
);

// GET /streamers/:channelId/confessions/private — streamer only
router.get(
  "/streamers/:channelId/confessions/private",
  async (req: Request, res: Response) => {
    const streamer = await resolveStreamer(req, res);
    if (!streamer) return;
    const parsed = ListPrivateConfessionsQueryParams.safeParse(req.query);
    if (!parsed.success || !isStreamerAdmin(parsed.data.token, streamer.id)) {
      return res.status(401).json({ message: "권한이 없어요." });
    }
    const rows = await db
      .select()
      .from(confessionsTable)
      .where(
        and(
          eq(confessionsTable.streamerId, streamer.id),
          eq(confessionsTable.isPrivate, true),
        ),
      )
      .orderBy(desc(confessionsTable.createdAt));
    return res.json(rows.map(toFull));
  },
);

// GET /streamers/:channelId/confessions/admin/all — streamer only
router.get(
  "/streamers/:channelId/confessions/admin/all",
  async (req: Request, res: Response) => {
    const streamer = await resolveStreamer(req, res);
    if (!streamer) return;
    const parsed = ListAllConfessionsQueryParams.safeParse(req.query);
    if (!parsed.success || !isStreamerAdmin(parsed.data.token, streamer.id)) {
      return res.status(401).json({ message: "권한이 없어요." });
    }
    const rows = await db
      .select()
      .from(confessionsTable)
      .where(eq(confessionsTable.streamerId, streamer.id))
      .orderBy(desc(confessionsTable.createdAt));
    return res.json(rows.map(toFull));
  },
);

// GET /streamers/:channelId/confessions
router.get(
  "/streamers/:channelId/confessions",
  async (req: Request, res: Response) => {
    const streamer = await resolveStreamer(req, res);
    if (!streamer) return;
    const parsed = ListConfessionsQueryParams.safeParse(req.query);
    const category = parsed.success ? parsed.data.category : undefined;
    const tokenParam = parsed.success ? parsed.data.token : undefined;
    const isAdmin = isStreamerAdmin(tokenParam, streamer.id);
    const conditions = [eq(confessionsTable.streamerId, streamer.id)];
    if (category) conditions.push(eq(confessionsTable.category, category));
    const rows = await db
      .select()
      .from(confessionsTable)
      .where(and(...conditions))
      .orderBy(desc(confessionsTable.createdAt))
      .limit(60);
    return res.json(rows.map(toPreview));
  },
);

// POST /streamers/:channelId/confessions
router.post(
  "/streamers/:channelId/confessions",
  async (req: Request, res: Response) => {
    const streamer = await resolveStreamer(req, res);
    if (!streamer) return;
    const parsed = CreateConfessionBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "입력값을 확인해 주세요." });
    }
    const { title, content, category, password, isPrivate } = parsed.data;
    const passwordHash = await bcrypt.hash(password, 10);
    const [row] = await db
      .insert(confessionsTable)
      .values({
        streamerId: streamer.id,
        title,
        content,
        category,
        passwordHash,
        isPrivate: !!isPrivate,
      })
      .returning();
    return res.status(201).json(toFull(row));
  },
);

// GET /streamers/:channelId/confessions/:id — streamer can view hidden via ?token=
router.get(
  "/streamers/:channelId/confessions/:id",
  async (req: Request, res: Response) => {
    const streamer = await resolveStreamer(req, res);
    if (!streamer) return;
    const parsed = GetConfessionParams.safeParse(req.params);
    if (!parsed.success)
      return res.status(404).json({ message: "글을 찾을 수 없어요." });
    const tokenParam =
      typeof req.query.token === "string" ? req.query.token : undefined;
    const isAdmin = isStreamerAdmin(tokenParam, streamer.id);
    const [row] = await db
      .select()
      .from(confessionsTable)
      .where(
        and(
          eq(confessionsTable.streamerId, streamer.id),
          eq(confessionsTable.id, parsed.data.id),
        ),
      )
      .limit(1);
    if (!row) return res.status(404).json({ message: "글을 찾을 수 없어요." });
    if (row.isPrivate && !isAdmin) {
      return res.status(403).json({ message: "비공개 글이에요." });
    }
    return res.json(toFull(row));
  },
);

// DELETE /streamers/:channelId/confessions/:id — password required
router.delete(
  "/streamers/:channelId/confessions/:id",
  async (req: Request, res: Response) => {
    const streamer = await resolveStreamer(req, res);
    if (!streamer) return;
    const params = DeleteConfessionParams.safeParse(req.params);
    const body = DeleteConfessionBody.safeParse(req.body);
    if (!params.success || !body.success) {
      return res.status(400).json({ message: "잘못된 요청이에요." });
    }
    const [row] = await db
      .select()
      .from(confessionsTable)
      .where(
        and(
          eq(confessionsTable.streamerId, streamer.id),
          eq(confessionsTable.id, params.data.id),
        ),
      )
      .limit(1);
    if (!row) return res.status(404).json({ message: "글을 찾을 수 없어요." });
    const ok = await bcrypt.compare(body.data.password, row.passwordHash);
    if (!ok) return res.status(403).json({ message: "비밀번호가 일치하지 않아요." });
    await db
      .delete(confessionsTable)
      .where(eq(confessionsTable.id, params.data.id));
    return res.json({ success: true });
  },
);

// PATCH /streamers/:channelId/confessions/:id — password required, updates confession
router.patch(
  "/streamers/:channelId/confessions/:id",
  async (req: Request, res: Response) => {
    const streamer = await resolveStreamer(req, res);
    if (!streamer) return;
    const params = UpdateConfessionParams.safeParse(req.params);
    const body = UpdateConfessionBody.safeParse(req.body);
    if (!params.success || !body.success) {
      return res.status(400).json({ message: "잘못된 요청이에요." });
    }
    const [row] = await db
      .select()
      .from(confessionsTable)
      .where(
        and(
          eq(confessionsTable.streamerId, streamer.id),
          eq(confessionsTable.id, params.data.id),
        ),
      )
      .limit(1);
    if (!row) return res.status(404).json({ message: "글을 찾을 수 없어요." });
    const ok = await bcrypt.compare(body.data.password, row.passwordHash);
    if (!ok) return res.status(403).json({ message: "비밀번호가 일치하지 않아요." });
    const [updated] = await db
      .update(confessionsTable)
      .set({
        title: body.data.title,
        content: body.data.content,
        category: body.data.category,
        isPrivate: body.data.isPrivate ?? row.isPrivate,
      })
      .where(eq(confessionsTable.id, params.data.id))
      .returning();
    if (!updated) return res.status(500).json({ message: "수정 중 오류가 발생했어요." });
    return res.json(toFull(updated));
  },
);

// POST /streamers/:channelId/confessions/:id/unlock — author password unlock
router.post(
  "/streamers/:channelId/confessions/:id/unlock",
  async (req: Request, res: Response) => {
    const streamer = await resolveStreamer(req, res);
    if (!streamer) return;
    const params = UnlockConfessionParams.safeParse(req.params);
    const body = UnlockConfessionBody.safeParse(req.body);
    if (!params.success || !body.success) {
      return res.status(400).json({ message: "잘못된 요청이에요." });
    }
    const [row] = await db
      .select()
      .from(confessionsTable)
      .where(
        and(
          eq(confessionsTable.streamerId, streamer.id),
          eq(confessionsTable.id, params.data.id),
        ),
      )
      .limit(1);
    if (!row) return res.status(404).json({ message: "글을 찾을 수 없어요." });
    const ok = await bcrypt.compare(body.data.password, row.passwordHash);
    if (!ok)
      return res.status(403).json({ message: "비밀번호가 일치하지 않아요." });
    return res.json(toFull(row));
  },
);

// POST /streamers/:channelId/confessions/:id/answer — streamer only
router.post(
  "/streamers/:channelId/confessions/:id/answer",
  async (req: Request, res: Response) => {
    const streamer = await resolveStreamer(req, res);
    if (!streamer) return;
    const params = AnswerConfessionParams.safeParse(req.params);
    const body = AnswerConfessionBody.safeParse(req.body);
    if (!params.success || !body.success) {
      return res.status(400).json({ message: "잘못된 요청이에요." });
    }
    if (!isStreamerAdmin(body.data.token, streamer.id)) {
      return res.status(401).json({ message: "권한이 없어요." });
    }
    const [row] = await db
      .update(confessionsTable)
      .set({ answer: body.data.answer, answeredAt: new Date() })
      .where(
        and(
          eq(confessionsTable.streamerId, streamer.id),
          eq(confessionsTable.id, params.data.id),
        ),
      )
      .returning();
    if (!row) return res.status(404).json({ message: "글을 찾을 수 없어요." });
    return res.json(toFull(row));
  },
);

// POST /streamers/:channelId/confessions/:id/verdict — streamer only
router.post(
  "/streamers/:channelId/confessions/:id/verdict",
  async (req: Request, res: Response) => {
    const streamer = await resolveStreamer(req, res);
    if (!streamer) return;
    const params = SetConfessionVerdictParams.safeParse(req.params);
    const body = SetConfessionVerdictBody.safeParse(req.body);
    if (!params.success || !body.success) {
      return res.status(400).json({ message: "잘못된 요청이에요." });
    }
    if (!isStreamerAdmin(body.data.token, streamer.id)) {
      return res.status(401).json({ message: "권한이 없어요." });
    }
    const verdict = body.data.verdict ?? null;
    const updates: Partial<Row> = { verdict };
    if (verdict !== null) updates.answeredAt = new Date();
    const [row] = await db
      .update(confessionsTable)
      .set(updates)
      .where(
        and(
          eq(confessionsTable.streamerId, streamer.id),
          eq(confessionsTable.id, params.data.id),
        ),
      )
      .returning();
    if (!row) return res.status(404).json({ message: "글을 찾을 수 없어요." });
    return res.json(toFull(row));
  },
);

export default router;

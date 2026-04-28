import { Router } from "express";
import * as dbModule from "@workspace/db";
const { db, confessionsTable, streamersTable } = dbModule as any;
import { and, desc, eq, sql, isNotNull, ne } from "drizzle-orm";
import { verifyStreamerToken } from "../lib/streamer-token.js";

const router = Router();

/**
 * 1. [GET] 고민 통계
 */
(router as any).get("/streamers/:channelId/confessions/stats", async (req: any, res: any) => {
  try {
    const { channelId } = req.params;
    const [streamer] = await (db as any)
      .select({ id: streamersTable.id })
      .from(streamersTable)
      .where(eq(streamersTable.channelId, channelId))
      .limit(1);

    if (!streamer) return res.status(404).json({ error: "Streamer not found" });

    const [stats] = await (db as any)
      .select({
        total: sql`COUNT(*)::int`,
        healed: sql`COUNT(CASE WHEN ${confessionsTable.answer} IS NOT NULL AND ${confessionsTable.answer} <> '' THEN 1 END)::int`,
        pending: sql`COUNT(CASE WHEN (${confessionsTable.answer} IS NULL OR ${confessionsTable.answer} = '') AND ${confessionsTable.isPrivate} = false THEN 1 END)::int`,
      })
      .from(confessionsTable)
      .where(eq(confessionsTable.streamerId, streamer.id));

    return res.json({
      total: stats?.total || 0,
      healed: stats?.healed || 0,
      pending: stats?.pending || 0,
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Stats error", message: err.message });
  }
});

/**
 * 2. [GET] 치유됨(답변 완료) 고민 목록
 * ⚠️ 반드시 /:confessionId 보다 먼저 등록해야 함
 */
(router as any).get("/streamers/:channelId/confessions/healed", async (req: any, res: any) => {
  try {
    const { channelId } = req.params;
    const [streamer] = await (db as any)
      .select({ id: streamersTable.id })
      .from(streamersTable)
      .where(eq(streamersTable.channelId, channelId))
      .limit(1);

    if (!streamer) return res.status(404).json({ error: "Streamer not found" });

    const rows = await (db as any)
      .select()
      .from(confessionsTable)
      .where(
        and(
          eq(confessionsTable.streamerId, streamer.id),
          eq(confessionsTable.isPrivate, false),
          isNotNull(confessionsTable.answer),
          ne(confessionsTable.answer, ""),
        )
      )
      .orderBy(desc(confessionsTable.createdAt));

    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: "Healed fetch error", message: err.message });
  }
});

/**
 * 3. [GET] 스트리머의 전체 고민 목록
 */
(router as any).get("/streamers/:channelId/confessions", async (req: any, res: any) => {
  try {
    const { channelId } = req.params;
    const { token, category } = req.query;

    const [streamer] = await (db as any)
      .select({ id: streamersTable.id })
      .from(streamersTable)
      .where(eq(streamersTable.channelId, channelId))
      .limit(1);

    if (!streamer) return res.status(404).json({ error: "Streamer not found" });

    const streamerId = verifyStreamerToken(token as string);
    const isStreamer = streamerId === streamer.id;

    const conditions = [eq(confessionsTable.streamerId, streamer.id)];
    if (!isStreamer) {
      conditions.push(eq(confessionsTable.isPrivate, false));
    }
    if (category) {
      conditions.push(eq(confessionsTable.category, category as string));
    }

    const rows = await (db as any)
      .select()
      .from(confessionsTable)
      .where(and(...conditions))
      .orderBy(desc(confessionsTable.createdAt));

    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: "Fetch error", message: err.message });
  }
});

/**
 * 4. [GET] 특정 게시글 상세 조회
 */
(router as any).get("/streamers/:channelId/confessions/:confessionId", async (req: any, res: any) => {
  try {
    const { channelId, confessionId } = req.params;
    const { token } = req.query;

    const [streamer] = await (db as any)
      .select({ id: streamersTable.id })
      .from(streamersTable)
      .where(eq(streamersTable.channelId, channelId))
      .limit(1);

    if (!streamer) return res.status(404).json({ error: "Streamer not found" });

    const [result] = await (db as any)
      .select({
        confession: confessionsTable,
        streamer: {
          name: streamersTable.name,
          profileImageUrl: streamersTable.profileImageUrl,
          channelId: streamersTable.channelId,
        },
      })
      .from(confessionsTable)
      .leftJoin(streamersTable, eq(confessionsTable.streamerId, streamersTable.id))
      .where(eq(confessionsTable.id, confessionId))
      .limit(1);

    if (!result) return res.status(404).json({ error: "게시글 없음" });

    const streamerId = verifyStreamerToken(token as string);
    const isStreamer = streamerId === streamer.id;

    // 비공개 글은 스트리머 또는 비밀번호 인증 없이 내용 숨김
    if (result.confession.isPrivate && !isStreamer) {
      return res.status(403).json({ error: "비공개 글입니다." });
    }

    return res.json({
      ...result.confession,
      streamer: result.streamer,
    });
  } catch (err: any) {
    return res.status(500).json({ error: "상세조회 실패", message: err.message });
  }
});

/**
 * 5. [POST] 고민 작성
 */
(router as any).post("/streamers/:channelId/confessions", async (req: any, res: any) => {
  try {
    const { channelId } = req.params;
    const { title, content, category, isPrivate, password } = req.body;

    if (!title || !content || !category) {
      return res.status(400).json({ error: "제목, 내용, 카테고리는 필수예요." });
    }

    const [streamer] = await (db as any)
      .select({ id: streamersTable.id })
      .from(streamersTable)
      .where(eq(streamersTable.channelId, channelId))
      .limit(1);

    if (!streamer) return res.status(404).json({ error: "Streamer not found" });

    const [inserted] = await (db as any)
      .insert(confessionsTable)
      .values({
        streamerId: streamer.id,
        title,
        content,
        category,
        isPrivate: isPrivate ?? false,
        passwordHash: password || "1234",
      })
      .returning();

    return res.status(201).json(inserted);
  } catch (err: any) {
    return res.status(500).json({ error: "Create error", message: err.message });
  }
});

/**
 * 6. [PUT] 게시글 수정
 */
(router as any).put("/streamers/:channelId/confessions/:confessionId", async (req: any, res: any) => {
  try {
    const { confessionId } = req.params;
    const { title, content, category, isPrivate, password } = req.body;

    const [existing] = await (db as any)
      .select()
      .from(confessionsTable)
      .where(eq(confessionsTable.id, confessionId))
      .limit(1);

    if (!existing) return res.status(404).json({ error: "게시글 없음" });

    if (existing.passwordHash !== password) {
      return res.status(403).json({ error: "비밀번호가 일치하지 않아요." });
    }

    const [updated] = await (db as any)
      .update(confessionsTable)
      .set({ title, content, category, isPrivate: isPrivate ?? existing.isPrivate })
      .where(eq(confessionsTable.id, confessionId))
      .returning();

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: "Update error", message: err.message });
  }
});

/**
 * 7. [DELETE] 게시글 삭제
 */
(router as any).delete("/streamers/:channelId/confessions/:confessionId", async (req: any, res: any) => {
  try {
    const { channelId, confessionId } = req.params;
    const { password, token } = req.body;

    const [streamer] = await (db as any)
      .select({ id: streamersTable.id })
      .from(streamersTable)
      .where(eq(streamersTable.channelId, channelId))
      .limit(1);

    if (!streamer) return res.status(404).json({ error: "Streamer not found" });

    const [existing] = await (db as any)
      .select()
      .from(confessionsTable)
      .where(eq(confessionsTable.id, confessionId))
      .limit(1);

    if (!existing) return res.status(404).json({ error: "게시글 없음" });

    // 스트리머 토큰으로 삭제 or 비밀번호로 삭제
    const streamerId = verifyStreamerToken(token);
    const isStreamer = streamerId === streamer.id;

    if (!isStreamer && existing.passwordHash !== password) {
      return res.status(403).json({ error: "비밀번호가 일치하지 않아요." });
    }

    await (db as any)
      .delete(confessionsTable)
      .where(eq(confessionsTable.id, confessionId));

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: "Delete error", message: err.message });
  }
});

/**
 * 8. [POST] 비밀번호로 비공개 글 열기 (unlock)
 */
(router as any).post("/streamers/:channelId/confessions/:confessionId/unlock", async (req: any, res: any) => {
  try {
    const { confessionId } = req.params;
    const { password } = req.body;

    const [existing] = await (db as any)
      .select({
        confession: confessionsTable,
        streamer: {
          name: streamersTable.name,
          profileImageUrl: streamersTable.profileImageUrl,
          channelId: streamersTable.channelId,
        },
      })
      .from(confessionsTable)
      .leftJoin(streamersTable, eq(confessionsTable.streamerId, streamersTable.id))
      .where(eq(confessionsTable.id, confessionId))
      .limit(1);

    if (!existing) return res.status(404).json({ error: "게시글 없음" });

    if (existing.confession.passwordHash !== password) {
      return res.status(403).json({ error: "비밀번호가 일치하지 않아요." });
    }

    return res.json({ ...existing.confession, streamer: existing.streamer });
  } catch (err: any) {
    return res.status(500).json({ error: "Unlock error", message: err.message });
  }
});

/**
 * 9. [PATCH] 스트리머 판결 (verdict)
 */
(router as any).patch("/streamers/:channelId/confessions/:confessionId/verdict", async (req: any, res: any) => {
  try {
    const { channelId, confessionId } = req.params;
    const { token, verdict } = req.body;

    const [streamer] = await (db as any)
      .select({ id: streamersTable.id })
      .from(streamersTable)
      .where(eq(streamersTable.channelId, channelId))
      .limit(1);

    if (!streamer) return res.status(404).json({ error: "Streamer not found" });

    const streamerId = verifyStreamerToken(token);
    if (streamerId !== streamer.id) {
      return res.status(403).json({ error: "권한이 없어요." });
    }

    const [updated] = await (db as any)
      .update(confessionsTable)
      .set({ verdict: verdict ?? null })
      .where(eq(confessionsTable.id, confessionId))
      .returning();

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: "Verdict error", message: err.message });
  }
});

/**
 * 10. [PATCH] 스트리머 답변 (answer)
 */
(router as any).patch("/streamers/:channelId/confessions/:confessionId/answer", async (req: any, res: any) => {
  try {
    const { channelId, confessionId } = req.params;
    const { token, answer } = req.body;

    const [streamer] = await (db as any)
      .select({ id: streamersTable.id })
      .from(streamersTable)
      .where(eq(streamersTable.channelId, channelId))
      .limit(1);

    if (!streamer) return res.status(404).json({ error: "Streamer not found" });

    const streamerId = verifyStreamerToken(token);
    if (streamerId !== streamer.id) {
      return res.status(403).json({ error: "권한이 없어요." });
    }

    const [updated] = await (db as any)
      .update(confessionsTable)
      .set({
        answer,
        answeredAt: answer ? new Date() : null,
      })
      .where(eq(confessionsTable.id, confessionId))
      .returning();

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: "Answer error", message: err.message });
  }
});

export default router;

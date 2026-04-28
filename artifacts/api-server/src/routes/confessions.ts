import { Router } from "express";
import * as dbModule from "@workspace/db";
const { db, confessionsTable, streamersTable } = dbModule as any;
import { and, desc, eq, sql } from "drizzle-orm";

const router = Router();

/**
 * 1. [GET] 특정 스트리머의 고민 통계 데이터
 * 경로: /api/streamers/:channelId/confessions/stats
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
        approved: sql`COUNT(*) FILTER (WHERE ${confessionsTable.verdict} = '승인')::int`,
        pending: sql`COUNT(*) FILTER (WHERE ${confessionsTable.verdict} = '대기')::int`,
      })
      .from(confessionsTable)
      .where(eq(confessionsTable.streamerId, streamer.id));

    return res.json({
      total: stats?.total || 0,
      approved: stats?.approved || 0,
      pending: stats?.pending || 0,
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch stats" });
  }
});

/**
 * 2. [GET] 해결된(답변 완료된) 고민 목록 조회
 * 경로: /api/streamers/:channelId/confessions/healed
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
          // 답변(answer)이 비어있지 않은 데이터만 가져옵니다.
          sql`${confessionsTable.answer} IS NOT NULL`
        )
      )
      .orderBy(desc(confessionsTable.createdAt));

    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch healed confessions" });
  }
});

/**
 * 3. [GET] 특정 스트리머의 고민 목록 전체 조회
 * 경로: /api/streamers/:channelId/confessions
 */
(router as any).get("/streamers/:channelId/confessions", async (req: any, res: any) => {
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
          eq(confessionsTable.isPrivate, false)
        )
      )
      .orderBy(desc(confessionsTable.createdAt));

    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch confessions" });
  }
});

/**
 * 4. [POST] 고민 작성
 */
(router as any).post("/confessions", async (req: any, res: any) => {
  try {
    const body = req.body;
    
    // 프론트엔드에서 streamerId(UUID)를 넘겨줘야 함
    if (!body.streamerId) {
      return res.status(400).json({ error: "streamerId is required" });
    }

    const [inserted] = await (db as any)
      .insert(confessionsTable)
      .values({
        streamerId: body.streamerId,
        title: body.title || "제목 없음",
        content: body.content,
        category: body.category || "기타",
        isPrivate: body.isPrivate ?? false,
        verdict: "대기",
        passwordHash: body.password || "1234",
      })
      .returning();

    return res.status(201).json(inserted);
  } catch (err: any) {
    console.error("Create error:", err.message);
    return res.status(500).json({ error: "Failed to create confession" });
  }
});

export default router;

import { Router } from "express";
import * as dbModule from "@workspace/db";
const { db, confessionsTable, streamersTable } = dbModule as any;
import { and, desc, eq, sql } from "drizzle-orm";

const router = Router();

/**
 * 1. [GET] 특정 스트리머의 고민 통계 데이터 (프론트엔드 최우선 요청)
 * 경로: /api/streamers/:channelId/confessions/stats
 */
(router as any).get("/streamers/:channelId/confessions/stats", async (req: any, res: any) => {
  try {
    const { channelId } = req.params;
    console.log(`[STATS] 통계 요청됨: ${channelId}`);

    // channelId로 스트리머 찾기
    const [streamer] = await (db as any)
      .select({ id: streamersTable.id })
      .from(streamersTable)
      .where(eq(streamersTable.channelId, channelId))
      .limit(1);

    if (!streamer) return res.status(404).json({ error: "Streamer not found" });

    // 통계 계산 (전체, 승인됨, 대기중)
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
    console.error("[STATS ERROR]:", err.message);
    return res.status(500).json({ error: "Failed to fetch stats" });
  }
});

/**
 * 2. [GET] 특정 스트리머의 고민 목록 조회
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
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch confessions" });
  }
});

/**
 * 3. [POST] 고민 작성
 */
(router as any).post("/confessions", async (req: any, res: any) => {
  try {
    const body = req.body;
    const [inserted] = await (db as any)
      .insert(confessionsTable)
      .values({
        streamerId: body.streamerId, // 프론트에서 UUID로 보내야 함
        title: body.title,
        content: body.content,
        category: body.category,
        isPrivate: body.isPrivate ?? false,
        verdict: "대기",
        passwordHash: "1234",
      })
      .returning();

    return res.status(201).json(inserted);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to create" });
  }
});

export default router;

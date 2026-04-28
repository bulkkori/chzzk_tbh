import { Router } from "express";
import * as dbModule from "@workspace/db";
const { db, confessionsTable, streamersTable } = dbModule as any;
import { and, desc, eq, sql } from "drizzle-orm";

const router = Router();

/**
 * 1. [POST] 고민 작성 (경로 수정됨)
 * 경로: /api/streamers/:channelId/confessions
 */
(router as any).post("/streamers/:channelId/confessions", async (req: any, res: any) => {
  try {
    const { channelId } = req.params; // URL에서 channelId 추출
    const { title, content, category, isPrivate, password } = req.body;
    
    console.log(`[POST] 고민 작성 요청 - 채널: ${channelId}`);

    // 1. channelId로 스트리머의 실제 UUID(id)를 찾습니다.
    const [streamer] = await (db as any)
      .select({ id: streamersTable.id })
      .from(streamersTable)
      .where(eq(streamersTable.channelId, channelId))
      .limit(1);
    
    if (!streamer) {
      return res.status(404).json({ error: "해당 스트리머를 찾을 수 없습니다." });
    }

    // 2. DB에 삽입 (찾은 streamer.id 사용)
    const [inserted] = await (db as any)
      .insert(confessionsTable)
      .values({
        streamerId: streamer.id, 
        title: title || "제목 없음",
        content: content,
        category: category || "일반",
        isPrivate: isPrivate ?? false,
        verdict: "대기", 
        passwordHash: password || "1234",
      })
      .returning();

    console.log("[POST] 고민 저장 완료:", inserted.id);
    return res.status(201).json(inserted);

  } catch (err: any) {
    console.error("[POST ERROR]:", err.message);
    return res.status(500).json({ error: "고민 저장에 실패했습니다.", details: err.message });
  }
});

/**
 * 2. [GET] 특정 스트리머의 고민 통계 데이터 (유지)
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
 * 3. [GET] 해결된 고민 목록 조회 (유지)
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
 * 4. [GET] 특정 스트리머의 고민 목록 전체 조회 (유지)
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

export default router;

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
 * 4. [POST] 고민 작성 (500 에러 디버깅 로직 포함)
 * 경로: /api/streamers/:channelId/confessions
 */
(router as any).post("/streamers/:channelId/confessions", async (req: any, res: any) => {
  try {
    const { channelId } = req.params;
    const { title, content, category, isPrivate, password } = req.body;

    console.log(`[POST] 저장 시도: 채널=${channelId}`);

    // 1. 스트리머 찾기
    const [streamer] = await (db as any)
      .select({ id: streamersTable.id })
      .from(streamersTable)
      .where(eq(streamersTable.channelId, channelId))
      .limit(1);

    if (!streamer) {
      console.error("[POST] 스트리머를 찾을 수 없음");
      return res.status(404).json({ error: "Streamer not found" });
    }

    // 2. DB 저장 시도
    const [inserted] = await (db as any)
      .insert(confessionsTable)
      .values({
        streamerId: streamer.id,
        title: title || "",
        content: content,
        category: category || "기타",
        isPrivate: isPrivate ?? false,
        verdict: "대기",
        passwordHash: password || "1234",
      })
      .returning();

    console.log("[POST] 저장 완료:", inserted.id);
    return res.status(201).json(inserted);

  } catch (err: any) {
    // 500 에러 발생 시 Vercel 로그에서 원인을 찾기 위해 기록
    console.error("!!! [DB INSERT ERROR] !!!");
    console.error("Message:", err.message);
    console.error("Detail:", err.detail); // Postgres의 상세 에러 내용
    
    return res.status(500).json({ 
      error: "Internal Server Error", 
      message: err.message,
      detail: err.detail
    });
  }
});

export default router;

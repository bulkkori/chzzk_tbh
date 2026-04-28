import { Router } from "express";
import * as dbModule from "@workspace/db";
const { db, confessionsTable, streamersTable } = dbModule as any;
import { and, desc, eq, sql } from "drizzle-orm";

const router = Router();

/**
 * 1. [GET] 고민 통계 (치유됨/기다리는 글 카운트)
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
        approved: sql`COUNT(CASE WHEN ${confessionsTable.verdict} = '승인' THEN 1 END)::int`,
        pending: sql`COUNT(CASE WHEN ${confessionsTable.verdict} = '대기' THEN 1 END)::int`,
        healed: sql`COUNT(CASE WHEN ${confessionsTable.answer} IS NOT NULL AND ${confessionsTable.answer} <> '' THEN 1 END)::int`,
      })
      .from(confessionsTable)
      .where(eq(confessionsTable.streamerId, streamer.id));

    return res.json({
      total: stats?.total || 0,
      approved: stats?.approved || 0,
      pending: stats?.pending || 0,
      healed: stats?.healed || 0,
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Stats error", message: err.message });
  }
});

/**
 * 2. [GET] 특정 게시글 상세 조회 (JOIN을 통해 'cls' 에러 해결)
 */
(router as any).get("/streamers/:channelId/confessions/:confessionId", async (req: any, res: any) => {
  try {
    const { confessionId } = req.params;

    const [result] = await (db as any)
      .select({
        confession: confessionsTable,
        streamer: {
          name: streamersTable.name,
          profileImageUrl: streamersTable.profileImageUrl,
          channelId: streamersTable.channelId
        }
      })
      .from(confessionsTable)
      .leftJoin(streamersTable, eq(confessionsTable.streamerId, streamersTable.id))
      .where(eq(confessionsTable.id, confessionId))
      .limit(1);

    if (!result) return res.status(404).json({ error: "게시글 없음" });

    // 프론트엔드가 요구하는 중첩 구조로 반환
    return res.json({
      ...result.confession,
      streamer: result.streamer 
    });
  } catch (err: any) {
    return res.status(500).json({ error: "상세조회 실패", message: err.message });
  }
});

/**
 * 3. [GET] 치유됨(해결된) 고민 목록
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
          sql`${confessionsTable.answer} IS NOT NULL AND ${confessionsTable.answer} <> ''`
        )
      )
      .orderBy(desc(confessionsTable.createdAt));

    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: "Healed fetch error" });
  }
});

/**
 * 4. [GET] 스트리머의 전체 고민 목록
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
    return res.status(500).json({ error: "Fetch error" });
  }
});

/**
 * 5. [POST] 고민 작성
 */
(router as any).post("/streamers/:channelId/confessions", async (req: any, res: any) => {
  try {
    const { channelId } = req.params;
    const { title, content, category, isPrivate, password } = req.body;

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
        title: title || "제목 없음",
        content: content,
        category: category || "기타",
        isPrivate: isPrivate ?? false,
        verdict: "대기", 
        passwordHash: password || "1234",
      })
      .returning();

    return res.status(201).json(inserted);
  } catch (err: any) {
    return res.status(500).json({ error: "Create error", message: err.message });
  }
});

export default router;

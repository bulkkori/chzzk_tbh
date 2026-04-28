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
    const { streamerId, title, content, category, isPrivate, password } = req.body;
    
    console.log("[POST] 고민 작성 요청:", { streamerId, title });

    // 1. 만약 프론트에서 보낸 streamerId가 'channelId'라면 UUID로 변환해줍니다.
    let targetStreamerId = streamerId;
    
    // ID가 UUID 형식이 아닐 경우 (치지직 채널 ID일 경우) 처리
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(streamerId);
    
    if (!isUuid) {
      const [found] = await (db as any)
        .select({ id: streamersTable.id })
        .from(streamersTable)
        .where(eq(streamersTable.channelId, streamerId))
        .limit(1);
      
      if (found) {
        targetStreamerId = found.id;
      } else {
        return res.status(404).json({ error: "해당 스트리머를 찾을 수 없습니다." });
      }
    }

    // 2. DB에 삽입
    const [inserted] = await (db as any)
      .insert(confessionsTable)
      .values({
        streamerId: targetStreamerId,
        title: title || "제목 없음",
        content: content,
        category: category || "일반",
        isPrivate: isPrivate ?? false,
        verdict: "대기", // 초기 상태
        passwordHash: password || "1234", // 나중에 수정/삭제를 위한 비밀번호
      })
      .returning();

    console.log("[POST] 고민 저장 완료:", inserted.id);
    return res.status(201).json(inserted);

  } catch (err: any) {
    console.error("[POST ERROR]:", err.message);
    return res.status(500).json({ error: "고민 저장에 실패했습니다.", details: err.message });
  }
});

export default router;

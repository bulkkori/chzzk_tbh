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
 * [POST] 고민 작성 - 500 에러 방지를 위한 컬럼 최소화 버전
 */
(router as any).post("/streamers/:channelId/confessions", async (req: any, res: any) => {
  try {
    const { channelId } = req.params;
    const { title, content, category, isPrivate, password } = req.body;

    // 1. 스트리머 UUID 찾기
    const [streamer] = await (db as any)
      .select({ id: streamersTable.id })
      .from(streamersTable)
      .where(eq(streamersTable.channelId, channelId))
      .limit(1);

    if (!streamer) return res.status(404).json({ error: "Streamer not found" });

    // 2. DB 저장 시도 
    // 만약 특정 컬럼에서 에러가 난다면, 그 컬럼을 주석 처리하며 범인을 찾을 수 있습니다.
    const insertData: any = {
      streamerId: streamer.id,
      content: content || "내용 없음",
      category: category || "기타",
      isPrivate: isPrivate ?? false,
      verdict: "대기", // 이 값이 DB Enum에 없을 경우 에러가 날 수 있음
    };

    // title이나 passwordHash 컬럼이 DB에 확실히 있는지 확인이 필요합니다.
    if (title) insertData.title = title;
    
    // 만약 passwordHash 컬럼 때문에 에러가 난다면 이 부분을 잠시 주석 처리해 보세요.
    insertData.passwordHash = password || "1234"; 

    const [inserted] = await (db as any)
      .insert(confessionsTable)
      .values(insertData)
      .returning();

    return res.status(201).json(inserted);

  } catch (err: any) {
    console.error("!!! DB INSERT 실패 !!!", err.message);
    // 프론트엔드 콘솔에서도 에러 내용을 볼 수 있게 응답에 담아 보냅니다.
    return res.status(500).json({ 
      error: "DB_ERROR", 
      message: err.message,
      detail: err.detail // Postgres가 알려주는 상세 원인 (예: "column does not exist")
    });
  }
});

export default router;

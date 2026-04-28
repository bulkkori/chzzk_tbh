import { Router } from "express";
import * as dbModule from "@workspace/db";
const { db, confessionsTable, streamersTable } = dbModule as any;
import { and, desc, eq, sql } from "drizzle-orm";

const router = Router();

/**
 * 1. [GET] 특정 스트리머의 고민 통계 데이터 (치유됨 카운트 로직 보강)
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

    // FILTER 대신 CASE WHEN을 사용하여 모든 환경에서 더 안정적으로 카운트합니다.
    const [stats] = await (db as any)
      .select({
        total: sql`COUNT(*)::int`,
        approved: sql`COUNT(CASE WHEN ${confessionsTable.verdict} = '승인' THEN 1 END)::int`,
        pending: sql`COUNT(CASE WHEN ${confessionsTable.verdict} = '대기' THEN 1 END)::int`,
        // 답변(answer)이 있는 글만 '치유됨'으로 카운트
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
    return res.status(500).json({ error: "Stats fetch error", message: err.message });
  }
});

/**
 * 2. [GET] 해결된(치유됨) 고민 목록 조회
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
    return res.status(500).json({ error: "Healed fetch error", message: err.message });
  }
});

/**
 * 3. [GET] 특정 게시글 상세 조회 (에러 추적 강화)
 * ★ 경로 순서가 중요합니다. stats와 healed 뒤에 와야 합니다.
 */
(router as any).get("/streamers/:channelId/confessions/:confessionId", async (req: any, res: any) => {
  try {
    const { confessionId } = req.params;

    const [confession] = await (db as any)
      .select()
      .from(confessionsTable)
      .where(eq(confessionsTable.id, confessionId))
      .limit(1);

    if (!confession) {
      return res.status(404).json({ error: "게시글을 찾을 수 없습니다." });
    }

    // 데이터를 그냥 주는 게 아니라, 프론트엔드에서 흔히 쓰는 필드명으로 한 번 더 정리해줍니다.
    // 만약 프론트엔드가 data.content 이런 식으로 접근한다면 아래 구조가 필요합니다.
    return res.json({
      ...confession,
      // 프론트엔드 스키마와 DB 컬럼명이 다를 경우를 대비해 매핑
      id: confession.id,
      streamerId: confession.streamerId,
      title: confession.title,
      content: confession.content,
      category: confession.category,
      answer: confession.answer,
      isPrivate: confession.isPrivate,
      verdict: confession.verdict,
      createdAt: confession.createdAt,
    });
  } catch (err: any) {
    return res.status(500).json({ error: "상세 정보 조회 실패", message: err.message });
  }
});

/**
 * 4. [GET] 전체 고민 목록 조회
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
    return res.status(500).json({ error: "Fetch error", message: err.message });
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

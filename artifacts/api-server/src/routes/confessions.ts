import { Router } from "express";
import * as dbModule from "@workspace/db";
const { db, confessionsTable, streamersTable } = dbModule as any;
import { and, desc, eq, sql } from "drizzle-orm";
import { verifyStreamerToken } from "../lib/streamer-token.js";

const router = Router();

/**
 * 1. [GET] 특정 스트리머의 고민 목록 조회
 * 경로: /api/streamers/:channelId/confessions
 */
(router as any).get("/streamers/:channelId/confessions", async (req: any, res: any) => {
  try {
    const { channelId } = req.params;

    // channelId를 이용해 스트리머의 내부 UUID를 찾습니다.
    const [streamer] = await (db as any)
      .select({ id: streamersTable.id })
      .from(streamersTable)
      .where(eq(streamersTable.channelId, channelId))
      .limit(1);

    if (!streamer) {
      return res.status(404).json({ error: "Streamer not found" });
    }

    // 해당 스트리머에게 달린 공개된 고민글들을 가져옵니다.
    const rows = await (db as any)
      .select()
      .from(confessionsTable)
      .where(
        and(
          eq(confessionsTable.streamerId, streamer.id),
          eq(confessionsTable.isPrivate, false),
          // 아직 승인 로직이 완벽하지 않다면 우선 "대기" 상태도 보이게 하거나, 
          // 프론트엔드 기획에 따라 eq(confessionsTable.verdict, "승인")을 추가하세요.
        )
      )
      .orderBy(desc(confessionsTable.createdAt));

    return res.json(rows);
  } catch (err: any) {
    console.error("Fetch confessions error:", err.message);
    return res.status(500).json({ error: "Failed to fetch confessions" });
  }
});

/**
 * 2. [GET] 스트리머의 고민 통계 데이터
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

    // 간단한 통계 쿼리
    const [stats] = await (db as any)
      .select({
        total: sql`count(*)`,
        approved: sql`count(*) filter (where verdict = '승인')`,
        pending: sql`count(*) filter (where verdict = '대기')`,
      })
      .from(confessionsTable)
      .where(eq(confessionsTable.streamerId, streamer.id));

    return res.json({
      total: Number(stats?.total || 0),
      approved: Number(stats?.approved || 0),
      pending: Number(stats?.pending || 0),
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch stats" });
  }
});

/**
 * 3. [POST] 고민 작성
 * 경로: /api/confessions
 */
(router as any).post("/confessions", async (req: any, res: any) => {
  try {
    const body = req.body;
    
    // 프론트엔드에서 streamerId가 UUID인지 channelId인지 확인이 필요합니다.
    // 여기서는 UUID로 저장된다고 가정합니다.
    const [inserted] = await (db as any)
      .insert(confessionsTable)
      .values({
        streamerId: body.streamerId,
        title: body.title,
        content: body.content,
        category: body.category,
        isPrivate: body.isPrivate ?? false,
        verdict: "대기", // 기본값
        passwordHash: body.password || "1234", // 임시 비밀번호 처리
      })
      .returning();

    return res.status(201).json(inserted);
  } catch (err: any) {
    console.error("Create confession error:", err.message);
    return res.status(500).json({ error: "Failed to create confession" });
  }
});

/**
 * 4. [DELETE] 고민 삭제
 */
(router as any).delete("/confessions/:id", async (req: any, res: any) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const payload = verifyStreamerToken(token || "");
    if (!payload) return res.status(401).json({ error: "Unauthorized" });

    await (db as any).delete(confessionsTable).where(eq(confessionsTable.id, req.params.id));
    return res.status(204).end();
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete" });
  }
});

export default router;

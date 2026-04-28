import { Router } from "express";
import * as dbModule from "@workspace/db";
const { db, confessionsTable, streamersTable } = dbModule as any;
import { and, desc, eq, sql } from "drizzle-orm";

const router = Router();

// [GET] 특정 스트리머의 고민 목록 (프론트엔드용 경로)
// 주소: /api/streamers/:channelId/confessions
(router as any).get("/streamers/:channelId/confessions", async (req: any, res: any) => {
  try {
    const { channelId } = req.params;

    // 1. 먼저 channelId로 스트리머의 내부 ID를 찾습니다.
    const [streamer] = await (db as any)
      .select({ id: streamersTable.id })
      .from(streamersTable)
      .where(eq(streamersTable.channelId, channelId))
      .limit(1);

    if (!streamer) return res.status(404).json({ error: "Streamer not found" });

    // 2. 해당 스트리머의 공개된 고민들을 가져옵니다.
    const rows = await (db as any)
      .select()
      .from(confessionsTable)
      .where(and(eq(confessionsTable.streamerId, streamer.id), eq(confessionsTable.isPrivate, false)))
      .orderBy(desc(confessionsTable.createdAt));

    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch confessions" });
  }
});

// [GET] 특정 스트리머의 해결된(답변된) 고민 목록 (추가됨!)
// 주소: /api/streamers/:channelId/confessions/healed (또는 프론트엔드 요구에 맞춘 경로)
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
      .where(and(
        eq(confessionsTable.streamerId, streamer.id),
        eq(confessionsTable.isPrivate, false),
        sql`${confessionsTable.answer} IS NOT NULL` // 답변이 있는 것들만
      ))
      .orderBy(desc(confessionsTable.createdAt));

    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch healed confessions" });
  }
});

export default router;

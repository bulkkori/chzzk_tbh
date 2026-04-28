import { Router } from "express";
import * as dbModule from "@workspace/db"; 
const { db, streamersTable, confessionsTable } = dbModule as any;
import { eq, sql, desc } from "drizzle-orm";

const router = Router();

// [GET] 전체 스트리머 목록
(router as any).get("/streamers", async (_req: any, res: any) => {
  try {
    const rows = await (db as any)
      .select({
        id: streamersTable.id,
        channelId: streamersTable.channelId,
        name: streamersTable.name,
        profileImageUrl: streamersTable.profileImageUrl,
        createdAt: streamersTable.createdAt, // 정렬을 위해 선택 필요
        confessionCount: sql`CAST(COUNT(CASE WHEN ${confessionsTable.isPrivate} = false THEN 1 END) AS INTEGER)`,
      })
      .from(streamersTable)
      .leftJoin(confessionsTable, eq(confessionsTable.streamerId, streamersTable.id))
      // ★ 중요: SELECT절에 있는 집계 함수 외의 모든 컬럼을 넣어줘야 에러가 안 납니다.
      .groupBy(
        streamersTable.id,
        streamersTable.channelId,
        streamersTable.name,
        streamersTable.profileImageUrl,
        streamersTable.createdAt
      )
      .orderBy(desc(streamersTable.createdAt));
      
    return res.json(rows);
  } catch (e: any) {
    console.error("[GET /streamers 에러]:", e.message);
    return res.status(500).json({ error: "Failed to fetch streamers", message: e.message });
  }
});

// [GET] 특정 스트리머 상세 정보
(router as any).get("/streamers/:channelId", async (req: any, res: any) => {
  try {
    const { channelId } = req.params;
    const [streamer] = await (db as any)
      .select()
      .from(streamersTable)
      .where(eq(streamersTable.channelId, channelId))
      .limit(1);

    if (!streamer) return res.status(404).json({ error: "Streamer not found" });
    return res.json(streamer);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

export default router;

import { Router } from "express";
import * as dbModule from "@workspace/db"; 
const { db, streamersTable, confessionsTable } = dbModule as any;
import { eq, sql, desc } from "drizzle-orm";

const router = Router();

// [GET] 전체 스트리머 목록 (이미 성공한 코드)
(router as any).get("/streamers", async (_req: any, res: any) => {
  try {
    const rows = await (db as any)
      .select({
        id: streamersTable.id,
        channelId: streamersTable.channelId,
        name: streamersTable.name,
        profileImageUrl: streamersTable.profileImageUrl,
        username: streamersTable.username,
        passwordHash: streamersTable.passwordHash,
        createdAt: streamersTable.createdAt,
        confessionCount: (sql as any)`CAST(COUNT(CASE WHEN ${confessionsTable.isPrivate} = false THEN 1 END) AS INTEGER)`,
      })
      .from(streamersTable)
      .leftJoin(confessionsTable, eq(confessionsTable.streamerId, streamersTable.id))
      .groupBy(streamersTable.id, streamersTable.channelId, streamersTable.name, streamersTable.profileImageUrl, streamersTable.username, streamersTable.passwordHash, streamersTable.createdAt)
      .orderBy(desc(streamersTable.createdAt));
      
    return res.json(rows);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// [GET] 특정 스트리머 상세 정보 (추가됨!)
// 프론트엔드가 호출하는 주소: /api/streamers/6ab86891e07489743437594c6e4dbf3a
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

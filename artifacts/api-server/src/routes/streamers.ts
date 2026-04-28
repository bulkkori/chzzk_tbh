import { Router } from "express";
import * as dbModule from "@workspace/db"; 
const { db, streamersTable, confessionsTable } = dbModule as any;
import { eq, sql, desc } from "drizzle-orm";

const router = Router();

function toSummary(row: any) {
  return {
    id: row.id,
    channelId: row.channelId,
    name: row.name,
    profileImageUrl: row.profileImageUrl,
    confessionCount: Number(row.confessionCount || 0),
    hasCredentials: !!row.username && !!row.passwordHash,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}

(router as any).get("/streamers", async (_req: any, res: any) => {
  try {
    console.log("[API] 스트리머 목록 조회 시도 (Strict GroupBy Version)");
    
    const rows = await (db as any)
      .select({
        id: streamersTable.id,
        channelId: streamersTable.channelId,
        name: streamersTable.name,
        profileImageUrl: streamersTable.profileImageUrl,
        username: streamersTable.username,
        passwordHash: streamersTable.passwordHash,
        createdAt: streamersTable.createdAt,
        // Neon에서 가장 안전한 CASE WHEN 방식으로 카운트
        confessionCount: (sql as any)`CAST(COUNT(CASE WHEN ${confessionsTable.isPrivate} = false THEN 1 END) AS INTEGER)`,
      })
      .from(streamersTable)
      .leftJoin(confessionsTable, eq(confessionsTable.streamerId, streamersTable.id))
      // ★ 중요: select한 모든 컬럼을 group 시켜야 PostgreSQL 에러가 안 납니다.
      .groupBy(
        streamersTable.id,
        streamersTable.channelId,
        streamersTable.name,
        streamersTable.profileImageUrl,
        streamersTable.username,
        streamersTable.passwordHash,
        streamersTable.createdAt
      )
      .orderBy(desc(streamersTable.createdAt));
      
    console.log(`[API] 조회 성공: ${rows.length}건`);
    return res.json(rows.map((r: any) => toSummary(r)));

  } catch (e: any) {
    console.error("[API 에러 상세]:", e.message);
    return res.status(500).json({ 
      error: "Internal Server Error", 
      message: e.message 
    });
  }
});

export default router;

import { Router } from "express";
import * as dbModule from "@workspace/db"; 
const { db, streamersTable, confessionsTable } = dbModule as any;
import { eq, sql, desc } from "drizzle-orm";

const router = Router();

function toSummary(row: any, confessionCount = 0) {
  return {
    id: row.id,
    channelId: row.channelId,
    name: row.name,
    profileImageUrl: row.profileImageUrl,
    confessionCount,
    hasCredentials: !!row.username && !!row.passwordHash,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}

(router as any).get("/streamers", async (_req: any, res: any) => {
  try {
    console.log("[DB] 스트리머 목록 조회 시도...");
    
    const rows = await (db as any)
      .select({
        id: streamersTable.id,
        channelId: streamersTable.channelId,
        name: streamersTable.name,
        profileImageUrl: streamersTable.profileImageUrl,
        username: streamersTable.username,
        passwordHash: streamersTable.passwordHash,
        createdAt: streamersTable.createdAt,
        // FILTER 대신 CASE WHEN을 사용하여 더 안정적으로 카운트합니다.
        confessionCount: (sql as any)`COUNT(CASE WHEN ${confessionsTable.isPrivate} = false THEN 1 END)::int`,
      })
      .from(streamersTable)
      .leftJoin(confessionsTable, eq(confessionsTable.streamerId, streamersTable.id))
      // PostgreSQL의 엄격한 GROUP BY 규칙을 위해 모든 선택 컬럼을 그룹화합니다.
      .groupBy(
        streamersTable.id, 
        streamersTable.channelId, 
        streamersTable.name, 
        streamersTable.profileImageUrl, 
        streamersTable.username, 
        streamersTable.password_hash, // 만약 스키마에 이렇게 되어있다면
        streamersTable.passwordHash, 
        streamersTable.createdAt
      )
      .orderBy(desc(streamersTable.createdAt));
      
    return res.json(rows.map((r: any) => toSummary(r, Number(r.confessionCount ?? 0))));
  } catch (e: any) {
    console.error("[DB 에러 발생]:", e.message);
    return res.status(500).json({ error: "Internal Server Error", message: e.message });
  }
});

export default router;

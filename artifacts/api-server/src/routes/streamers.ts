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
    console.log("[DB] 스트리머 목록 조회 시작...");
    
    const rows = await (db as any)
      .select({
        id: streamersTable.id,
        channelId: streamersTable.channelId,
        name: streamersTable.name,
        profileImageUrl: streamersTable.profileImageUrl,
        username: streamersTable.username,
        passwordHash: streamersTable.passwordHash,
        createdAt: streamersTable.createdAt,
        // COUNT 내부에 조건을 넣어 깔끔하게 집계합니다.
        confessionCount: (sql as any)`count(${confessionsTable.id}) filter (where ${confessionsTable.isPrivate} = false)::int`,
      })
      .from(streamersTable)
      .leftJoin(confessionsTable, eq(confessionsTable.streamerId, streamersTable.id))
      // 중요: streamersTable.id가 Primary Key이므로 이것만 그룹화해도 충분합니다.
      .groupBy(streamersTable.id)
      .orderBy(desc(streamersTable.createdAt));
      
    console.log(`[DB] 조회 성공: ${rows.length}건`);
    return res.json(rows.map((r: any) => toSummary(r, Number(r.confessionCount ?? 0))));

  } catch (e: any) {
    console.error("[DB 에러 상세]:", e.message);
    // 에러 발생 시 클라이언트에 상세 메시지 전달 (디버깅용)
    return res.status(500).json({ 
      error: "Internal Server Error", 
      message: e.message 
    });
  }
});

export default router;

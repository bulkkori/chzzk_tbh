import { Router } from "express";
import * as dbModule from "@workspace/db"; 
const { db, streamersTable, confessionsTable } = dbModule as any;
import { eq, sql, desc } from "drizzle-orm";

const router = Router();

/**
 * 프론트엔드에서 사용하기 편하도록 데이터 형식을 정리하는 함수
 */
function toSummary(row: any) {
  return {
    id: row.id,
    channelId: row.channelId,
    name: row.name,
    profileImageUrl: row.profileImageUrl,
    // count 집계 결과는 문자열로 올 수 있으므로 숫자로 변환
    confessionCount: Number(row.confessionCount || 0),
    hasCredentials: !!row.username && !!row.passwordHash,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}

(router as any).get("/streamers", async (_req: any, res: any) => {
  try {
    console.log("[API] 스트리머 목록 & 고민 개수 조회 시작");
    
    const rows = await (db as any)
      .select({
        id: streamersTable.id,
        channelId: streamersTable.channelId,
        name: streamersTable.name,
        profileImageUrl: streamersTable.profileImageUrl,
        username: streamersTable.username,
        passwordHash: streamersTable.passwordHash,
        createdAt: streamersTable.createdAt,
        // 공개된 고민들만 카운트합니다.
        confessionCount: (sql as any)`count(${confessionsTable.id}) filter (where ${confessionsTable.isPrivate} = false)::int`,
      })
      .from(streamersTable)
      .leftJoin(confessionsTable, eq(confessionsTable.streamerId, streamersTable.id))
      // streamersTable.id가 PK이므로 이것만 그룹화해도 충분합니다 (Postgres 규칙)
      .groupBy(streamersTable.id)
      .orderBy(desc(streamersTable.createdAt));
      
    console.log(`[API] 조회 성공: ${rows.length}건`);
    return res.json(rows.map((r: any) => toSummary(r)));

  } catch (e: any) {
    console.error("[API 에러]:", e.message);
    return res.status(500).json({ 
      error: "Internal Server Error", 
      message: e.message 
    });
  }
});

export default router;

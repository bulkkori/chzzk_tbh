import { Router } from "express";
import * as dbModule from "@workspace/db"; 
// 번들링 이슈를 대비해 db 객체가 제대로 들어왔는지 체크하기 위해 구조분해 할당을 분리해서 작성할 수도 있습니다.
const { db, streamersTable, confessionsTable } = dbModule as any;
import { eq, sql, desc } from "drizzle-orm";

const router = Router();

/**
 * DB에서 가져온 데이터를 프론트엔드용 요약 데이터로 변환하는 함수
 */
function toSummary(row: any, confessionCount = 0) {
  return {
    id: row.id,
    channelId: row.channelId,
    name: row.name,
    profileImageUrl: row.profileImageUrl,
    confessionCount,
    // username과 passwordHash가 있으면 가입된 스트리머로 판단
    hasCredentials: !!row.username && !!row.passwordHash,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}

(router as any).get("/streamers", async (_req: any, res: any) => {
  console.log("[API] GET /api/streamers 요청 시작");

  try {
    // 1. DB 객체 초기화 여부 확인
    if (!db) {
      console.error("[API] 에러: db 객체가 초기화되지 않았습니다. 빌드 설정을 확인하세요.");
      return res.status(500).json({ error: "Database not initialized" });
    }

    // 2. 쿼리 실행 (타임아웃 발생 지점)
    console.log("[API] DB 쿼리 실행 중...");
    const rows = await (db as any)
      .select({
        id: streamersTable.id,
        channelId: streamersTable.channelId,
        name: streamersTable.name,
        profileImageUrl: streamersTable.profileImageUrl,
        username: streamersTable.username,
        passwordHash: streamersTable.passwordHash,
        createdAt: streamersTable.createdAt,
        // 공개된 고민 개수 카운트
        confessionCount: (sql as any)`COALESCE(COUNT(${confessionsTable.id}) FILTER (WHERE ${confessionsTable.isPrivate} = false), 0)::int`,
      })
      .from(streamersTable)
      .leftJoin(confessionsTable, eq(confessionsTable.streamerId, streamersTable.id))
      .groupBy(streamersTable.id)
      .orderBy(desc(streamersTable.createdAt));
      
    console.log(`[API] 쿼리 성공: ${rows.length}명의 스트리머를 찾았습니다.`);

    // 3. 데이터 변환 및 응답
    return res.json(rows.map((r: any) => toSummary(r, Number(r.confessionCount ?? 0))));

  } catch (e: any) {
    // ★ 핵심: Vercel 로그에 상세 에러를 찍습니다.
    console.error("[API] /api/streamers에서 심각한 오류 발생:");
    console.error("- 메시지:", e.message);
    console.error("- 에러 코드:", e.code); // DB 연결 오류 시 'ECONNREFUSED' 등이 찍힘
    console.error("- 스택 트레이스:", e.stack);

    // 클라이언트에게도 에러 원인을 살짝 보여주면 디버깅이 빨라집니다.
    return res.status(500).json({ 
      error: "Internal Server Error",
      message: e.message // 배포 후 안정되면 보안을 위해 이 줄은 지우는 게 좋습니다.
    });
  }
});

export default router;

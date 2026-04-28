import { Router } from "express";
// 1. 먼저 전체 모듈을 가져옵니다.
import * as dbModule from "@workspace/db"; 
// 2. 가져온 모듈을 any로 캐스팅한 뒤 구조 분해 할당을 합니다.
const { db, streamersTable, confessionsTable } = dbModule as any;
import { eq, sql, desc } from "drizzle-orm";

const router = Router();

// ... (기존과 동일)

// Express 5 및 Drizzle 타입 충돌을 피하기 위해 as any를 핸들러 등록 시 사용합니다.
(router as any).get("/streamers", async (_req: any, res: any) => {
  const rows = await (db as any)
    .select({
      id: streamersTable.id,
      channelId: streamersTable.channelId,
      name: streamersTable.name,
      profileImageUrl: streamersTable.profileImageUrl,
      username: streamersTable.username,
      passwordHash: streamersTable.passwordHash,
      createdAt: streamersTable.createdAt,
      // sql 템플릿 리터럴도 any로 처리하여 타입 에러를 방지합니다.
      confessionCount: (sql as any)`COALESCE(COUNT(${confessionsTable.id}) FILTER (WHERE ${confessionsTable.isPrivate} = false), 0)::int`,
    })
    .from(streamersTable)
    .leftJoin(
      confessionsTable,
      eq(confessionsTable.streamerId, streamersTable.id),
    )
    .groupBy(streamersTable.id)
    .orderBy(desc(streamersTable.createdAt));
    
  return res.json(
    rows.map((r: any) =>
      toSummary(
        {
          id: r.id,
          channelId: r.channelId,
          name: r.name,
          profileImageUrl: r.profileImageUrl,
          createdAt: r.createdAt,
        },
        Number(r.confessionCount ?? 0),
      ),
    ),
  );
});

// GET /streamers/:channelId 엔드포인트도 동일하게 (router as any) 적용
(router as any).get(
  "/streamers/:channelId",
  async (req: any, res: any) => {
    // ... 내부 로직
  }
);

export default router;

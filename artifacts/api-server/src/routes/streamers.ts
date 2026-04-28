import { Router } from "express";
// 1. DB 모듈을 통째로 가져온 뒤 any로 캐스팅하여 타입 충돌 방지
import * as dbModule from "@workspace/db";
const { db, streamersTable, confessionsTable } = dbModule as any;
import { eq, sql, desc } from "drizzle-orm";

const router = Router();

// 2. 사라졌던 toSummary 함수 정의 (타입 에러 방지를 위해 파라미터 any 처리)
function toSummary(row: any, confessionCount = 0) {
  return {
    id: row.id,
    channelId: row.channelId,
    name: row.name,
    profileImageUrl: row.profileImageUrl,
    confessionCount,
    hasCredentials: !!row.username && !!row.passwordHash,
    // Date 객체인지 확인 후 처리
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}

// GET /streamers
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
            username: r.username,
            passwordHash: r.passwordHash
          },
          Number(r.confessionCount ?? 0),
        ),
      ),
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "서버 오류가 발생했어요." });
  }
});

// GET /streamers/:channelId
(router as any).get(
  "/streamers/:channelId",
  async (req: any, res: any) => {
    try {
      const channelId = req.params.channelId;
      if (!channelId) return res.status(404).json({ message: "스트리머를 찾을 수 없어요." });

      const [row] = await (db as any)
        .select()
        .from(streamersTable)
        .where(eq(streamersTable.channelId, channelId))
        .limit(1);

      if (!row) return res.status(404).json({ message: "스트리머를 찾을 수 없어요." });
      return res.json(toSummary(row));
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "서버 오류가 발생했어요." });
    }
  },
);

export default router;

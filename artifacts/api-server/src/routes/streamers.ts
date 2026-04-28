import { Router } from "express"; // IRouter 제거
// DB 관련 객체들을 가져올 때 any로 우회하여 타입 충돌을 방지합니다.
import { db, streamersTable, confessionsTable } from "@workspace/db" as any;
import { eq, sql, desc } from "drizzle-orm";

const router = Router();

function toSummary(row: any, confessionCount = 0) { // row 타입을 any로 변경
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

// GET /streamers — list streamers with confession counts
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
      // Drizzle 타입 에러 방지를 위해 sql 부분도 any 캐스팅
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

// GET /streamers/:channelId — single streamer
(router as any).get(
  "/streamers/:channelId",
  async (req: any, res: any) => {
    const channelId = req.params.channelId;
    if (!channelId) return res.status(404).json({ message: "스트리머를 찾을 수 없어요." });
    const [row] = await (db as any)
      .select()
      .from(streamersTable)
      .where(eq(streamersTable.channelId, channelId))
      .limit(1);
    if (!row) return res.status(404).json({ message: "스트리머를 찾을 수 없어요." });
    return res.json(toSummary(row));
  },
);

export default router;

import { Router } from "express";
import * as dbModule from "@workspace/db"; // 다시 워크스페이스 이름으로!
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
      .leftJoin(confessionsTable, eq(confessionsTable.streamerId, streamersTable.id))
      .groupBy(streamersTable.id)
      .orderBy(desc(streamersTable.createdAt));
      
    return res.json(rows.map((r: any) => toSummary(r, Number(r.confessionCount ?? 0))));
  } catch (e) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;

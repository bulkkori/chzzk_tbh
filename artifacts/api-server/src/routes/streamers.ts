import { Router, type IRouter, type Request, type Response } from "express";
import { db, streamersTable, confessionsTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";

const router: IRouter = Router();

function toSummary(row: {
  id: string;
  channelId: string;
  name: string;
  profileImageUrl: string | null;
  username: string | null;
  passwordHash: string | null;
  createdAt: Date;
}, confessionCount = 0) {
  return {
    id: row.id,
    channelId: row.channelId,
    name: row.name,
    profileImageUrl: row.profileImageUrl,
    confessionCount,
    hasCredentials: !!row.username && !!row.passwordHash,
    createdAt: row.createdAt.toISOString(),
  };
}

// GET /streamers — list streamers with confession counts
router.get("/streamers", async (_req, res) => {
  const rows = await db
    .select({
      id: streamersTable.id,
      channelId: streamersTable.channelId,
      name: streamersTable.name,
      profileImageUrl: streamersTable.profileImageUrl,
      username: streamersTable.username,
      passwordHash: streamersTable.passwordHash,
      createdAt: streamersTable.createdAt,
      confessionCount: sql<number>`COALESCE(COUNT(${confessionsTable.id}) FILTER (WHERE ${confessionsTable.isPrivate} = false), 0)::int`,
    })
    .from(streamersTable)
    .leftJoin(
      confessionsTable,
      eq(confessionsTable.streamerId, streamersTable.id),
    )
    .groupBy(streamersTable.id)
    .orderBy(desc(streamersTable.createdAt));
  return res.json(
    rows.map((r) =>
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
router.get(
  "/streamers/:channelId",
  async (req: Request, res: Response) => {
    const channelId = req.params.channelId;
    if (!channelId) return res.status(404).json({ message: "스트리머를 찾을 수 없어요." });
    const [row] = await db
      .select()
      .from(streamersTable)
      .where(eq(streamersTable.channelId, channelId))
      .limit(1);
    if (!row) return res.status(404).json({ message: "스트리머를 찾을 수 없어요." });
    return res.json(toSummary(row));
  },
);

// Note: streamer registration now happens automatically as part of the
// chzzk OAuth callback (see routes/auth-chzzk.ts). The first time a streamer
// signs in with chzzk we upsert them, so there's no separate POST register
// endpoint anymore.

export default router;

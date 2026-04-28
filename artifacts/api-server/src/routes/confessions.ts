import { Router } from "express";
import * as dbModule from "@workspace/db";
const { db, confessionsTable, streamersTable } = dbModule as any;
import { and, desc, eq, sql } from "drizzle-orm";

const router = Router();

(router as any).post("/streamers/:channelId/confessions", async (req: any, res: any) => {
  try {
    const { channelId } = req.params;
    const { title, content, category, isPrivate } = req.body;

    const [streamer] = await (db as any)
      .select({ id: streamersTable.id })
      .from(streamersTable)
      .where(eq(streamersTable.channelId, channelId))
      .limit(1);

    if (!streamer) return res.status(404).json({ error: "Streamer not found" });

    // DB 에러를 피하기 위해 가장 확실한 데이터만 넣습니다.
    const [inserted] = await (db as any)
      .insert(confessionsTable)
      .values({
        streamerId: streamer.id,
        title: title || "제목 없음",
        content: content,
        category: category || "기타",
        isPrivate: isPrivate ?? false,
        // 만약 '대기'로 에러가 난다면 'pending'으로 바꿔보세요.
        verdict: "대기", 
      })
      .returning();

    return res.status(201).json(inserted);

  } catch (err: any) {
    console.error("!!! DB INSERT ERROR !!!", err.message);
    return res.status(500).json({ 
      error: "DB_ERROR", 
      message: err.message,
      // Postgres의 상세 에러를 프론트에서 확인하기 위해 추가
      detail: err.detail 
    });
  }
});

// GET /stats, GET /confessions 등 기존 코드는 그대로 유지하세요!

export default router;

import { Router } from "express";
// @workspace 별칭 사용 (build.mjs에서 번들링 처리됨)
import * as dbModule from "@workspace/db";
import * as apiZodModule from "@workspace/api-zod";
const { db, confessionsTable, streamersTable } = dbModule as any;
import { and, desc, eq, sql } from "drizzle-orm";
// 내부 lib 경로는 상대경로 + .js 유지
import { signStreamerToken, verifyStreamerToken } from "../lib/streamer-token.js";

const router = Router();

// [GET] 공개된 고민 목록 조회
(router as any).get("/confessions", async (req: any, res: any) => {
  try {
    const streamerId = req.query.streamerId as string;
    if (!streamerId) return res.status(400).json({ error: "streamerId is required" });

    const rows = await (db as any)
      .select()
      .from(confessionsTable)
      .where(
        and(
          eq(confessionsTable.streamerId, streamerId),
          eq(confessionsTable.isPrivate, false),
          eq(confessionsTable.verdict, "승인")
        )
      )
      .orderBy(desc(confessionsTable.createdAt));

    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch confessions" });
  }
});

// [POST] 고민 작성
(router as any).post("/confessions", async (req: any, res: any) => {
  try {
    const body = req.body;
    const [inserted] = await (db as any)
      .insert(confessionsTable)
      .values({
        streamerId: body.streamerId,
        title: body.title,
        content: body.content,
        category: body.category,
        isPrivate: body.isPrivate ?? false,
        verdict: "대기",
      })
      .returning();

    return res.status(201).json(inserted);
  } catch (err) {
    return res.status(500).json({ error: "Failed to create confession" });
  }
});

// [DELETE] 고민 삭제 (인증 필요)
(router as any).delete("/confessions/:id", async (req: any, res: any) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const payload = verifyStreamerToken(token || "");
    if (!payload) return res.status(401).json({ error: "Unauthorized" });

    await (db as any).delete(confessionsTable).where(eq(confessionsTable.id, req.params.id));
    return res.status(204).end();
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete" });
  }
});

export default router;

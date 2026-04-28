import { Router } from "express";
import * as dbModule from "@workspace/db"; 
const { db, streamersTable } = dbModule as any;
import { desc } from "drizzle-orm";

const router = Router();

(router as any).get("/streamers", async (_req: any, res: any) => {
  try {
    console.log("[DB] 단순 조회 시작...");
    
    // 복잡한 JOIN을 빼고 streamers 테이블만 먼저 읽어봅니다.
    const rows = await (db as any)
      .select()
      .from(streamersTable)
      .orderBy(desc(streamersTable.createdAt));
      
    console.log(`[DB] 조회 성공: ${rows.length}건`);
    return res.json(rows);

  } catch (e: any) {
    console.error("[DB 상세 에러]:", e.message);
    return res.status(500).json({ 
      error: "Connection Test Failed", 
      message: e.message 
    });
  }
});

export default router;

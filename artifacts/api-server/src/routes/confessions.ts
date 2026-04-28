import { Router } from "express";
import * as dbModule from "@workspace/db";
const { db, confessionsTable, streamersTable } = dbModule as any;
import { and, desc, eq, sql } from "drizzle-orm";

const router = Router();

// [POST] 고민 작성
(router as any).post("/streamers/:channelId/confessions", async (req: any, res: any) => {
  try {
    const { channelId } = req.params;
    const { title, content, category, isPrivate, password } = req.body;

    console.log(`[POST] 저장 시도: 채널ID=${channelId}, 내용=${content?.slice(0, 10)}...`);

    // 1. 스트리머 찾기
    const [streamer] = await (db as any)
      .select({ id: streamersTable.id })
      .from(streamersTable)
      .where(eq(streamersTable.channelId, channelId))
      .limit(1);

    if (!streamer) {
      console.error("[POST 에러] 스트리머를 찾을 수 없음:", channelId);
      return res.status(404).json({ error: "Streamer not found" });
    }

    // 2. DB 저장 시도 (컬럼명을 스키마와 최대한 대조해 보세요!)
    const [inserted] = await (db as any)
      .insert(confessionsTable)
      .values({
        streamerId: streamer.id,
        // 만약 DB에 title 컬럼이 없다면 이 줄이 에러를 냅니다. 
        // 테이블 구조에 따라 아래 항목들을 조절해야 할 수 있습니다.
        title: title || "", 
        content: content,
        category: category || "기타",
        isPrivate: isPrivate ?? false,
        verdict: "대기",
        // DB 컬럼명이 password_hash라면 Drizzle이 자동으로 매핑하지만, 
        // 아예 컬럼이 없을 수도 있으니 주의하세요.
        passwordHash: password || null, 
      })
      .returning();

    console.log("[POST] 저장 성공 ID:", inserted.id);
    return res.status(201).json(inserted);

  } catch (err: any) {
    // ★ 여기가 핵심입니다! Vercel 로그에 에러의 진짜 이유가 찍힙니다.
    console.error("!!! [DB 저장 실패 상세 사유] !!!");
    console.error("에러 메시지:", err.message);
    console.error("에러 코드:", err.code); // 예: '23502' (Not Null 위반), '42703' (컬럼 없음)
    
    return res.status(500).json({ 
      error: "Internal Server Error", 
      message: err.message 
    });
  }
});

// ... (나머지 GET /stats, GET /confessions 등 기존 코드 유지)

export default router;

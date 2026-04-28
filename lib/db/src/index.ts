import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL 환경 변수가 설정되지 않았습니다.");
}

// Vercel 환경에서 DB 연결 안정성을 높이는 설정
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // 5초 이내에 연결 안 되면 에러 발생
  ssl: {
    // Vercel에서 자가 서명 인증서를 사용하는 DB(대부분의 클라우드 DB)에 접속할 때 필수
    rejectUnauthorized: false,
  },
});

// 에러 발생 시 로그를 남겨서 디버깅을 돕습니다.
pool.on("error", (err) => {
  console.error("[DB Pool Error] 예기치 못한 DB 연결 오류:", err);
});

export const db = drizzle(pool, { schema });
export * from "./schema/index.js";

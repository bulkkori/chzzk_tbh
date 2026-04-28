import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL 환경 변수가 없습니다.");
}

// 연결 옵션을 객체로 명확히 분리
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  max: 1, // 서버리스 환경에서는 커넥션을 적게 유지하는 것이 안전합니다.
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: {
    rejectUnauthorized: false, // SSL 인증서 검증 건너뛰기 (대부분의 클라우드 DB 필수)
  },
};

export const pool = new Pool(poolConfig);

// 연결 에러 핸들링
pool.on("error", (err) => {
  console.error("[DB Pool] 연결 중 치명적 에러:", err);
});

export const db = drizzle(pool, { schema });

export * from "./schema/index.js";

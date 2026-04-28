import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Neon 풀러(PgBouncer) 사용 시 필수 설정
  ssl: {
    rejectUnauthorized: false,
  },
  max: 1, // 서버리스 환경에서는 1로 설정하는 것이 가장 안정적입니다.
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});

pool.on("error", (err) => {
  console.error("[DB Pool] Unexpected error on idle client", err);
});

export const db = drizzle(pool, { schema });
export * from "./schema/index.js";

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
// [중요] 폴더 임포트 시 /index.js 명시
import * as schema from "./schema/index.js"; 

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false,
});

export const db = drizzle(pool, { schema });

// [중요] 다시 내보낼 때도 /index.js 명시
export * from "./schema/index.js";

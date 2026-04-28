import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Vercel Serverless 환경 최적화: 연결 수 최소화
  max: 1,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  // Vercel Postgres(Neon) 사용 시 SSL 필요
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false,
});

export const db = drizzle(pool, { schema });

export * from "./schema";

import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";

// 스트리머 테이블 정의
export const streamersTable = pgTable("streamers", {
  id: uuid("id").defaultRandom().primaryKey(),
  channelId: text("channel_id").unique().notNull(),
  name: text("name").notNull(),
  profileImageUrl: text("profile_image_url"),
  username: text("username"),
  passwordHash: text("password_hash"), // 스트리머 로그인용
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 고민(Confessions) 테이블 정의
export const confessionsTable = pgTable("confessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  streamerId: uuid("streamer_id").references(() => streamersTable.id).notNull(),
  title: text("title"),
  content: text("content").notNull(),
  category: text("category"),
  answer: text("answer"),
  isPrivate: boolean("is_private").default(false).notNull(),
  verdict: text("verdict").default("대기").notNull(), // '대기', '승인', '거절'
  
  // ★ 이 줄이 핵심입니다. 이게 있어야 SQL에 포함됩니다.
  passwordHash: text("password_hash"), 
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  answeredAt: timestamp("answered_at"),
});

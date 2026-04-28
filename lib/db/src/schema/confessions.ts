import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { pgTable, uuid, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
// [중요] 상대 경로 임포트에 .js 추가
import { streamersTable } from "./streamers.js"; 

export const confessionsTable = pgTable("confessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  streamerId: uuid("streamer_id")
    .references(() => streamersTable.id)
    .notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull(), // 예: '질문', '고백', '요청' 등
  answer: text("answer"),
  isPrivate: boolean("is_private").default(false).notNull(),
  verdict: text("verdict"), // 예: '승인', '반려' 등
  createdAt: timestamp("created_at").defaultNow().notNull(),
  answeredAt: timestamp("answered_at"),
});

export const confessionsRelations = relations(confessionsTable, ({ one }) => ({
  streamer: one(streamersTable, {
    fields: [confessionsTable.streamerId],
    references: [streamersTable.id],
  }),
}));

export type Confession = typeof confessionsTable.$inferSelect;
export type InsertConfession = typeof confessionsTable.$inferInsert;

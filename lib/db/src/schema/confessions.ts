import { pgTable, uuid, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
// 상대 경로에 .js 가 붙어있는지 확인하세요!
import { streamersTable } from "./streamers.js"; 

export const confessionsTable = pgTable("confessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  streamerId: uuid("streamer_id")
    .references(() => streamersTable.id)
    .notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull(), 
  answer: text("answer"),
  isPrivate: boolean("is_private").default(false).notNull(),
  verdict: text("verdict"), 
  createdAt: timestamp("created_at").defaultNow().notNull(),
  answeredAt: timestamp("answered_at"),
});

export const confessionsRelations = relations(confessionsTable, ({ one }) => ({
  streamer: one(streamersTable, {
    fields: [confessionsTable.streamerId],
    references: [streamersTable.id],
  }),
}));

import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { confessionsTable } from "./confessions.js"; // 참조가 있다면 .js 확인

export const streamersTable = pgTable("streamers", {
  id: uuid("id").defaultRandom().primaryKey(),
  channelId: text("channel_id").notNull().unique(),
  name: text("name").notNull(),
  profileImageUrl: text("profile_image_url"),
  username: text("username").unique(),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const streamersRelations = relations(streamersTable, ({ many }) => ({
  confessions: many(confessionsTable),
}));

export type Streamer = typeof streamersTable.$inferSelect;
export type InsertStreamer = typeof streamersTable.$inferInsert;

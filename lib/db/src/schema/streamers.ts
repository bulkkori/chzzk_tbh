import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const streamersTable = pgTable("streamers", {
  id: uuid("id").primaryKey().defaultRandom(),
  channelId: text("channel_id").notNull().unique(),
  name: text("name").notNull(),
  profileImageUrl: text("profile_image_url"),
  username: text("username").unique(),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Streamer = typeof streamersTable.$inferSelect;
export type InsertStreamer = typeof streamersTable.$inferInsert;

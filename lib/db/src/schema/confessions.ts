import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { streamersTable } from "./streamers";

export const confessionsTable = pgTable(
  "confessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    streamerId: uuid("streamer_id")
      .notNull()
      .references(() => streamersTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    category: text("category").notNull(),
    passwordHash: text("password_hash").notNull(),
    answer: text("answer"),
    isPrivate: boolean("is_private").notNull().default(false),
    verdict: text("verdict"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
  },
  (table) => ({
    streamerIdx: index("confessions_streamer_id_idx").on(table.streamerId),
  }),
);

export type Confession = typeof confessionsTable.$inferSelect;
export type InsertConfession = typeof confessionsTable.$inferInsert;

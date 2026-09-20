import {
  sqliteTable,
  text,
  integer,
  primaryKey,
} from "drizzle-orm/sqlite-core";
const record = (name: string) =>
  sqliteTable(
    name,
    {
      id: text("id").notNull(),
      workspace: text("workspace").notNull(),
      data: text("data").notNull(),
    },
    (t) => [primaryKey({ columns: [t.workspace, t.id] })],
  );
export const users = record("users");
export const documents = record("documents");
export const print_jobs = record("print_jobs");
export const payments = record("payments");
export const printers = record("printers");
export const printer_status = record("printer_status");
export const pricing = record("pricing");
export const analytics = record("analytics");
export const resource_usage = record("resource_usage");
export const ai_insights = record("ai_insights");
export const rate_limits = sqliteTable("rate_limits", {
  workspace: text("workspace").primaryKey(),
  window: integer("window").notNull(),
  count: integer("count").notNull(),
});

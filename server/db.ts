import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "data.db");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
    description TEXT DEFAULT '', url TEXT, sort_order INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS daily_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, task_id TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0, note TEXT, UNIQUE(date, task_id)
  );
  CREATE TABLE IF NOT EXISTS notebook_entries (
    id TEXT PRIMARY KEY, subject TEXT, chapter TEXT DEFAULT '', content TEXT, created_at TEXT
  );
  CREATE TABLE IF NOT EXISTS homework (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, subject TEXT DEFAULT '', deadline TEXT DEFAULT '', done INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS settings ( key TEXT PRIMARY KEY, value TEXT NOT NULL );
`);

const cols = db.pragma("table_info(notebook_entries)") as Array<{ name: string }>;
if (!cols.some((c) => c.name === "chapter")) {
  db.exec("ALTER TABLE notebook_entries ADD COLUMN chapter TEXT DEFAULT ''");
}

export default db;

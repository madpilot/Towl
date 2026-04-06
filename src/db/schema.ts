import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('towl.db');
  await migrate(db);
  return db;
}

async function migrate(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`PRAGMA journal_mode = WAL;`);

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL
    );
    INSERT INTO schema_version (version)
      SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM schema_version);
  `);

  const row = await database.getFirstAsync<{ version: number }>(
    'SELECT version FROM schema_version LIMIT 1'
  );
  const currentVersion = row?.version ?? 0;

  if (currentVersion < 1) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS local_lists (
        local_id     TEXT PRIMARY KEY,
        server_id    INTEGER,
        household_id INTEGER NOT NULL,
        name         TEXT NOT NULL,
        is_dirty     INTEGER NOT NULL DEFAULT 1,
        is_deleted   INTEGER NOT NULL DEFAULT 0,
        last_synced  INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS local_items (
        local_id      TEXT PRIMARY KEY,
        server_id     INTEGER,
        list_local_id TEXT NOT NULL,
        name          TEXT NOT NULL,
        description   TEXT NOT NULL DEFAULT '',
        icon_key      TEXT,
        category      TEXT NOT NULL DEFAULT '',
        is_checked    INTEGER NOT NULL DEFAULT 0,
        is_dirty      INTEGER NOT NULL DEFAULT 1,
        is_deleted    INTEGER NOT NULL DEFAULT 0,
        created_at    INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_items_list ON local_items(list_local_id);
      CREATE INDEX IF NOT EXISTS idx_items_server ON local_items(server_id);

      CREATE TABLE IF NOT EXISTS item_history (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        name          TEXT NOT NULL UNIQUE,
        display_name  TEXT NOT NULL,
        icon_key      TEXT,
        category      TEXT NOT NULL DEFAULT '',
        use_count     INTEGER NOT NULL DEFAULT 1,
        last_used_at  INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_history_use_count ON item_history(use_count DESC);
      CREATE INDEX IF NOT EXISTS idx_history_last_used ON item_history(last_used_at DESC);

      CREATE TABLE IF NOT EXISTS sync_queue (
        id            TEXT PRIMARY KEY,
        op_type       TEXT NOT NULL,
        payload       TEXT NOT NULL,
        list_local_id TEXT,
        created_at    INTEGER NOT NULL,
        attempts      INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_sync_queue_created ON sync_queue(created_at ASC);

      UPDATE schema_version SET version = 1;
    `);
  }

  if (currentVersion < 2) {
    await database.execAsync(`
      ALTER TABLE local_items ADD COLUMN is_important INTEGER NOT NULL DEFAULT 0;
      UPDATE schema_version SET version = 2;
    `);
  }

  if (currentVersion < 3) {
    await database.execAsync(`
      ALTER TABLE local_items ADD COLUMN server_category_id       INTEGER;
      ALTER TABLE local_items ADD COLUMN server_category_name     TEXT;
      ALTER TABLE local_items ADD COLUMN server_category_ordering INTEGER;
      UPDATE schema_version SET version = 3;
    `);
  }
}

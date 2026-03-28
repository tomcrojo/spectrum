import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { readFileSync, readdirSync } from 'fs'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

export function initDatabase(): Database.Database {
  const dbPath = join(app.getPath('userData'), 'centipede.db')
  db = new Database(dbPath)

  // Enable WAL mode for better read performance
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  runMigrations(db)

  return db
}

function runMigrations(database: Database.Database): void {
  // Create migrations tracking table
  database.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Find and run pending migrations
  const migrationsDir = join(__dirname, '..', 'db', 'migrations')
  let files: string[] = []

  try {
    files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort()
  } catch {
    // In dev mode, migrations might be in a different location
    const devMigrationsDir = join(__dirname, 'migrations')
    try {
      files = readdirSync(devMigrationsDir)
        .filter((f) => f.endsWith('.sql'))
        .sort()

      // Use dev path instead
      runMigrationFiles(database, devMigrationsDir, files)
      return
    } catch {
      // Try the source path directly
      const srcMigrationsDir = join(
        app.getAppPath(),
        'src',
        'main',
        'db',
        'migrations'
      )
      try {
        files = readdirSync(srcMigrationsDir)
          .filter((f) => f.endsWith('.sql'))
          .sort()
        runMigrationFiles(database, srcMigrationsDir, files)
        return
      } catch {
        console.warn('No migrations directory found, skipping migrations')
        return
      }
    }
  }

  runMigrationFiles(database, migrationsDir, files)
}

function runMigrationFiles(
  database: Database.Database,
  dir: string,
  files: string[]
): void {
  const applied = new Set(
    database
      .prepare('SELECT name FROM _migrations')
      .all()
      .map((row: any) => row.name)
  )

  for (const file of files) {
    if (applied.has(file)) continue

    const sql = readFileSync(join(dir, file), 'utf-8')
    database.exec(sql)
    database.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file)
    console.log(`Applied migration: ${file}`)
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

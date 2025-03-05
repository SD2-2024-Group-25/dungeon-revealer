import * as sqlite from "sqlite";
import * as fs from "fs-extra";
import * as path from "path";

export const migrate = async ({
  db,
  dataPath,
}: {
  db: sqlite.Database;
  dataPath: string;
}) => {
  await db.exec(/* SQL */ `
    BEGIN;
    PRAGMA "user_version" = 4;
    
    -- Check if the 'sessions' table exists before creating it
    CREATE TABLE IF NOT EXISTS "sessions" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "name" TEXT NOT NULL,
      "created_at" INT NOT NULL,
      "updated_at" INT NOT NULL
    );
  `);

  const insertSessionQuery = /* SQL */ `
    INSERT INTO "sessions" (
      "name",
      "created_at",
      "updated_at"
    ) VALUES (?, ?, ?);
  `;

  // Load data from settings.json
  const settingsPath = path.join(dataPath, "research", "settings.json");
  if (fs.existsSync(settingsPath)) {
    const settings = fs.readJSONSync(settingsPath);
    if (Array.isArray(settings.downloads)) {
      for (const sessionName of settings.downloads) {
        const now = Date.now();
        await db.run(insertSessionQuery, sessionName, now, now);
      }
    }
  }

  await db.run(/* SQL */ `COMMIT;`);
};

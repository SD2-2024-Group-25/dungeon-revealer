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
    PRAGMA "user_version" = 6;
    
    CREATE TABLE "defaultMaps" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "title" TEXT NOT NULL,
      "map_id" TEXT NOT NULL,
      "setting_json" TEXT NOT NULL
    );
  `);

  const insertMapQuery = /* SQL */ `
    INSERT INTO "defaultMaps" (
      "title",
      "map_id",
      "setting_json"
    ) VALUES (?, ?, ?);
  `;

  // Load data from maps.json
  const mapsPath = path.join(dataPath, "setting.json");
  if (fs.existsSync(mapsPath)) {
    const maps = fs.readJSONSync(mapsPath);
    if (Array.isArray(maps)) {
      for (const map of maps) {
        const mapJsonPath = path.join(dataPath, map.map_json);
        let mapJsonContent = "";
        if (fs.existsSync(mapJsonPath)) {
          mapJsonContent = fs.readFileSync(mapJsonPath, "utf-8");
        }
        await db.run(insertMapQuery, map.title, map.map_id, mapJsonContent);
      }
    }
  }

  await db.run(/* SQL */ `COMMIT;`);
};

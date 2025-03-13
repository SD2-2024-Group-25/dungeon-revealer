const express = require("express");
const fs = require("fs-extra");
const path = require("path");

const router = express.Router();

router.get("/maps", async (req, res) => {
  //API to fetch all maps from maps folder
  const basePath = path.resolve("./");
  const MapsPath = path.join(basePath, "data", "maps");

  try {
    const files = await fs.readdir(MapsPath);

    const scenarioFolders = (
      await Promise.all(
        files.map(async (file) => {
          const fullPath = path.join(MapsPath, file);
          const stats = await fs.stat(fullPath);
          return stats.isDirectory() ? file : null;
        })
      )
    ).filter(Boolean);

    res.status(200).json(scenarioFolders);
  } catch (error) {
    console.error("Error fetching maps:", error);
    res.status(500).json({ error: "Failed to fetch maps." });
  }
});

module.exports = router;

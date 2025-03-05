const express = require("express");
const fs = require("fs-extra");
const path = require("path");

const router = express.Router();

router.get("/maps", async (req, res) => {
  //API to fetch all scenarios from default folder
  const basePath = path.resolve("./");
  const defaultMapsPath = path.join(basePath, "data", "defaultmaps");

  try {
    const files = await fs.readdir(defaultMapsPath);

    const scenarioFolders = (
      await Promise.all(
        files.map(async (file) => {
          const fullPath = path.join(defaultMapsPath, file);
          const stats = await fs.stat(fullPath);
          return stats.isDirectory() ? file : null;
        })
      )
    ).filter(Boolean);

    res.status(200).json(scenarioFolders);
  } catch (error) {
    console.error("Error fetching default scenarios:", error);
    res.status(500).json({ error: "Failed to fetch default scenarios." });
  }
});

module.exports = router;

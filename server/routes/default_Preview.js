const express = require("express");
const fs = require("fs-extra");
const path = require("path");

const router = express.Router();

router.get("/mapImage", async (req, res) => {
  // API to get image path for preview (defaultmaps)
  const { sourceFolder } = req.query;

  if (!sourceFolder) {
    return res.status(400).json({ error: "Missing source folder." });
  }

  try {
    const basePath = path.resolve("./");
    const sourcePath = path.join(basePath, "data", "defaultmaps", sourceFolder);

    const possibleFiles = ["map.png", "map.jpg", "map.jpeg", "map.svg"];

    let mapImage = null;
    for (const fileName of possibleFiles) {
      const filePath = path.join(sourcePath, fileName);
      if (fs.existsSync(filePath)) {
        mapImage = filePath;
        break;
      }
    }

    if (!mapImage) {
      return res.status(404).json({ error: "Map image not found." });
    }

    res.sendFile(mapImage);
  } catch (error) {
    console.error("Error fetching map image:", error);
    res.status(500).json({ error: "Failed to fetch map image." });
  }
});

module.exports = router;

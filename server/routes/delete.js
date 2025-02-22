const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");

router.delete("/destroy", (req, res) => {
  //Delete defaultmap api
  const { folderName } = req.body;
  try {
    const basePath = path.resolve("./");
    const targetPath = path.join(basePath, "data", "defaultmaps", folderName);

    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ error: "Folder not found." });
    }

    fs.rmSync(targetPath, { recursive: true, force: true });

    res.status(200).json({ message: "Folder deleted successfully!" });
  } catch (err) {
    console.error("Error deleting folder:", err);
    res.status(500).json({ error: "Failed to delete folder." });
  }
});

module.exports = router;

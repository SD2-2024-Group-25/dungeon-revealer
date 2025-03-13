const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const server = require("../server");

router.post("/scenario", async (req, res) => {
  const { files, parentFolder, folderName } = req.body;
  try {
    const basePath = path.resolve("./");
    const destinationPath = path.join(
      basePath,
      "data",
      parentFolder,
      folderName
    );
    fs.mkdirSync(destinationPath, { recursive: true });

    files.forEach((file) => {
      const buffer = Buffer.from(file.buffer);
      const filePath = path.join(destinationPath, file.name);
      fs.writeFileSync(filePath, buffer);
    });

    if (!server.maps) {
      // Makes sure maps is initialized
      throw new Error("Maps instance is not initialized.");
    }
    await server.maps.reload(); // Reload maps, basically re-reads the maps folder

    res.status(200).json({ message: "Files uploaded successfully!" });
  } catch (err) {
    console.error("Error uploading scenario:", err);
    res.status(500).json({ error: "Failed to upload scenario." });
  }
});

module.exports = router;

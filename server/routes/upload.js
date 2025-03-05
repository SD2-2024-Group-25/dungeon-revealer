const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");

router.post("/scenario", (req, res) => {
  //API to upload scenario

  //const { files, folderName } = req.body;
  const { files, parentFolder, folderName } = req.body;
  try {
    const basePath = path.resolve("./");
    //const destinationPath = path.join(basePath, "data", "maps", folderName); //Defines the path
    const destinationPath = path.join(
      basePath,
      "data",
      parentFolder,
      folderName
    ); //Defines the path

    fs.mkdirSync(destinationPath, { recursive: true });

    files.forEach((file) => {
      const buffer = Buffer.from(file.buffer);
      const filePath = path.join(destinationPath, file.name);
      fs.writeFileSync(filePath, buffer);
    });

    res.status(200).json({ message: "Files uploaded successfully!" });
  } catch (err) {
    console.error("Error uploading scenario:", err);
    res.status(500).json({ error: "Failed to upload scenario." });
  }
});

module.exports = router;

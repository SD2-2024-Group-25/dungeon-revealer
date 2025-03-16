//api's for select-map-modal.tsx
const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const fs1 = require("fs-extra");
const server = require("../server");

router.post("/upload", async (req, res) => {
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

//module.exports = router;

router.post("/copy", async (req, res) => {
  // API to copy a default scenario into the main maps folder.
  const { sourceFolder, newScenarioName } = req.body;

  if (!sourceFolder || !newScenarioName) {
    return res
      .status(400)
      .json({ error: "Missing source folder or new scenario name." });
  }

  try {
    const basePath = path.resolve("./");
    const sourcePath = path.join(basePath, "data", "defaultmaps", sourceFolder);
    const destinationPath = path.join(
      basePath,
      "data",
      "maps",
      newScenarioName
    );

    if (!fs.existsSync(sourcePath)) {
      return res.status(404).json({ error: "Source folder not found." });
    }

    // Copy the entire default scenario folder into the main maps folder.
    await fs1.copy(sourcePath, destinationPath);

    // Pinpoint and update the JSON file within the destination folder.
    const files = await fs1.readdir(destinationPath);
    const jsonFile = files.find((file) => file.endsWith(".json"));

    if (jsonFile) {
      const jsonFilePath = path.join(destinationPath, jsonFile);

      // Read the JSON file, update the id and title, and then write it back.
      const jsonData = await fs1.readJson(jsonFilePath);
      jsonData.id = newScenarioName; // Update ID to match the new scenario name.
      jsonData.title = newScenarioName; // Update title to the new scenario name.
      await fs1.writeJson(jsonFilePath, jsonData, { spaces: 2 });
      console.log(`Updated JSON file: ${jsonFilePath}`);
    }

    // After the copy and update, reload the in-memory maps cache.
    console.log("Calling maps.reload() after copying files...");
    if (!server.maps) {
      throw new Error("Maps instance is not initialized.");
    }
    await server.maps.reload();
    //console.log("maps.reload() completed successfully!"); // debug
    return res
      .status(200)
      .json({ message: "Scenario copied and updated successfully!" });
  } catch (error) {
    console.error("Error copying and updating scenario:", error);
    return res
      .status(500)
      .json({ error: "Failed to copy and update scenario." });
  }
});

//module.exports = router;

router.delete("/delete", (req, res) => {
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

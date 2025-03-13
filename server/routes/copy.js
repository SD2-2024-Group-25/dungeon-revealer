const express = require("express");
const fs = require("fs-extra");
const path = require("path");
const server = require("../server");
const emitter = server.emitter;
const router = express.Router();

router.post("/files", async (req, res) => {
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
    await fs.copy(sourcePath, destinationPath);

    // Pinpoint and update the JSON file within the destination folder.
    const files = await fs.readdir(destinationPath);
    const jsonFile = files.find((file) => file.endsWith(".json"));

    if (jsonFile) {
      const jsonFilePath = path.join(destinationPath, jsonFile);

      // Read the JSON file, update the id and title, and then write it back.
      const jsonData = await fs.readJson(jsonFilePath);
      jsonData.id = newScenarioName; // Update ID to match the new scenario name.
      jsonData.title = newScenarioName; // Update title to the new scenario name.
      await fs.writeJson(jsonFilePath, jsonData, { spaces: 2 });
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

module.exports = router;

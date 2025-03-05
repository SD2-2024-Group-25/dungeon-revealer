const express = require("express");
const fs = require("fs-extra");
const path = require("path");

const router = express.Router();

router.post("/files", async (req, res) => {
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

    await fs.copy(sourcePath, destinationPath);

    //Pinpoints the JSON file
    const files = await fs.readdir(destinationPath);
    const jsonFile = files.find((file) => file.endsWith(".json"));

    if (jsonFile) {
      const jsonFilePath = path.join(destinationPath, jsonFile);

      //Modifies JSON file specifically
      const jsonData = await fs.readJson(jsonFilePath);
      jsonData.id = newScenarioName; // Update ID to match new name
      jsonData.title = `${newScenarioName}`; // Update Title to the new name

      await fs.writeJson(jsonFilePath, jsonData, { spaces: 2 });

      console.log(`Updated JSON file: ${jsonFilePath}`);
    }

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

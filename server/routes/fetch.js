// api's to fetch from map / defaultamps
const express = require("express");
const fs = require("fs-extra");
const path = require("path");
const router = express.Router();
const maphelp = require("../maphelper");

async function getFirstIteration(sessionPath) {
  // Grabs the first iteration
  const folders = await fs.readdir(sessionPath);
  const iterationFolders = await Promise.all(
    folders.map(async (folder) => {
      const folderPath = path.join(sessionPath, folder);
      const stats = await fs.stat(folderPath);
      return stats.isDirectory() ? folder : null;
    })
  );

  const validFolders = iterationFolders.filter(Boolean);
  return validFolders[0] || null;
}

router.get("/maps", async (req, res) => {
  // API to fetch all maps from maps folder
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

router.get("/defaultmaps", async (req, res) => {
  // API to fetch all scenarios from default folder
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

router.get("/iterationMap", async (req, res) => {
  // Gets the map from an session (grabs image from the first iteration folder)
  const { sessionName } = req.query;
  if (!sessionName) {
    console.error("Missing sessionName in query:", req.query);
    return res.status(400).json({ error: "Missing sessionName" });
  }

  try {
    const basePath = path.resolve("./");
    const sessionPath = path.join(
      basePath,
      "public",
      "research",
      "saved",
      sessionName
    );
    if (!(await fs.pathExists(sessionPath))) {
      console.error("Session not found at:", sessionPath);
      return res.status(404).json({ error: "Session not found" });
    }

    const firstIteration = await getFirstIteration(sessionPath);
    if (!firstIteration) {
      console.error("No iterations found in session at:", sessionPath);
      return res.status(404).json({ error: "No iterations found" });
    }

    const iterationFolderPath = path.join(sessionPath, firstIteration);

    // Read the settings.json file to get mapPath
    const settingsPath = path.join(iterationFolderPath, "settings.json");
    let mapFileName = "map.png";

    if (await fs.pathExists(settingsPath)) {
      try {
        const settings = await fs.readJson(settingsPath);
        if (settings && settings.mapPath) {
          mapFileName = settings.mapPath;
        }
        console.log("Found settings, using mapPath:", mapFileName);
      } catch (err) {
        console.error("Error reading settings.json:", err);
      }
    } else {
      console.warn("settings.json not found at:", settingsPath);
    }

    const iterationMapPath = path.join(iterationFolderPath, mapFileName);
    if (!(await fs.pathExists(iterationMapPath))) {
      console.error("Map image not found at:", iterationMapPath);
      return res.status(404).json({ error: "Map image not found." });
    }

    const imageUrl = `/api/iteration/${sessionName}/${firstIteration}/${mapFileName}`;
    console.log("Returning map image URL:", imageUrl);
    return res.status(200).json({ url: imageUrl });
  } catch (error) {
    console.error("Error fetching map:", error);
    return res.status(500).json({ error: "Failed to fetch map." });
  }
});

router.get("/whiteboardIterations", async (req, res) => {
  // Gets all the images in whiteboard folder
  const { sessionName } = req.query;
  if (!sessionName) {
    return res.status(400).json({ error: "Missing sessionName" });
  }

  try {
    const basePath = path.resolve("./");
    const whiteboardFolder = path.join(
      basePath,
      "public",
      "research",
      "saved",
      sessionName,
      "whiteboard"
    );

    const images = await fs.readdir(whiteboardFolder);

    const filteredImages = images.filter((file) =>
      file.toLowerCase().endsWith(".png")
    );

    return res.status(200).json({ images: filteredImages });
  } catch (error) {
    console.error("Error fetching whiteboard:", error);
    return res.status(500).json({ error: "Failed to fetch whiteboard." });
  }
});

module.exports = router;

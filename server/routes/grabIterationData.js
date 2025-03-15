const express = require("express");
const fs = require("fs-extra");
const path = require("path");
const router = express.Router();

async function getIterationFolders(sessionPath) {
  // Goes through session folder and reads all iteration folders
  try {
    const folders = await fs.readdir(sessionPath);
    const iterationFolders = await Promise.all(
      folders.map(async (folder) => {
        const folderPath = path.join(sessionPath, folder);
        const stats = await fs.stat(folderPath);
        return stats.isDirectory() ? folder : null;
      })
    );
    return iterationFolders.filter(Boolean);
  } catch (error) {
    console.error("Error reading iteration folders:", error);
    return [];
  }
}

async function readIterations(iterationPath) {
  // Reads the settings.json file for needed information
  const settingsPath = path.join(iterationPath, "settings.json");
  try {
    const content = await fs.readFile(settingsPath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading settings.json in ${iterationPath}:`, error);
    return null;
  }
}

function tokenMovements(iterationsData) {
  const tokenMovements = {}; // Looking for id, label, color, x, y
  iterationsData.forEach((iterationItem) => {
    const iterationName = iterationItem.iteration;
    const tokens = iterationItem.tokens || [];
    tokens.forEach((token) => {
      if (token.isVisibleForPlayers) {
        // Only show the ones that are visible to players
        if (!tokenMovements[token.id]) {
          tokenMovements[token.id] = {
            label: token.label,
            color: token.color,
            movements: [],
          };
        }
        tokenMovements[token.id].movements.push({
          iteration: iterationName,
          x: token.x,
          y: token.y,
        });
      }
    });
  });
  return tokenMovements;
}

router.post("/visualData", async (req, res) => {
  const { sessionName } = req.body;
  if (!sessionName) {
    return res.status(400).json({ error: "Missing sessionName." });
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
      return res.status(404).json({ error: "Session not found." });
    }

    // Get all iteration folder names.
    const iterationFolders = await getIterationFolders(sessionPath);

    // For each iteration folder, read its settings.json
    const iterationsData = await Promise.all(
      iterationFolders.map(async (iterationFolder) => {
        const iterationPath = path.join(sessionPath, iterationFolder);
        const settings = await readIterations(iterationPath);
        if (settings && settings.tokens) {
          return { iteration: iterationFolder, tokens: settings.tokens };
        } else {
          return { iteration: iterationFolder, tokens: [] };
        }
      })
    );

    const sortedData = tokenMovements(iterationsData);

    return res.status(200).json({ data: sortedData });
  } catch (error) {
    console.error("Error grabbing visual data:", error);
    return res.status(500).json({ error: "Failed to get visual data." });
  }
});

module.exports = router;

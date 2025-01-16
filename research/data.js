const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const { copyFile, mkdir, stat } = require("fs/promises");

const timestamp = new Date()
  .toISOString()
  .replace("T", "_")
  .replace(/:/g, "-")
  .split(".")[0];

// Promisify readdir to handle it asynchronously
const readdir = promisify(fs.readdir);

// Define paths
const basePath = path.resolve(__dirname, "..");
const settingsPath = path.join(basePath, "data", "settings.json");
const researchSettingsPath = path.join(basePath, "research", "settings.json");
const downloadsFolder = path.join(basePath, "research", "downloads");

// Function to update settings.json in the destination folder
async function updateSettings(destinationSettingsPath, newId) {
  try {
    const data = JSON.parse(fs.readFileSync(destinationSettingsPath, "utf-8"));
    data.id = newId; // Update the id field

    fs.writeFileSync(
      destinationSettingsPath,
      JSON.stringify(data, null, 2),
      "utf-8"
    );
    console.log(`Updated 'id' in settings.json to: ${newId}`);
  } catch (err) {
    console.error(`Error updating settings.json: ${err.message}`, err);
  }
}

// Function to update research/settings.json with new session folder name
async function updateResearchSettings(sessionFolderName) {
  try {
    const data = JSON.parse(fs.readFileSync(researchSettingsPath, "utf-8"));
    if (!Array.isArray(data.downloads)) {
      data.downloads = [];
    }

    data.downloads.push(sessionFolderName);

    fs.writeFileSync(
      researchSettingsPath,
      JSON.stringify(data, null, 2),
      "utf-8"
    );
    console.log(
      `Added '${sessionFolderName}' to 'downloads' in research/settings.json`
    );
  } catch (err) {
    console.error(`Error updating research/settings.json: ${err.message}`, err);
  }
}

// Function to extract the currentMapId from settings.json
async function extractCurrentMapId(settingsPath) {
  try {
    const data = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    const currentMapId = data.currentMapId;
    if (!currentMapId)
      throw new Error("currentMapId not found in settings.json");

    return currentMapId;
  } catch (err) {
    console.error(`Error reading settings.json: ${err.message}`, err);
    throw err;
  }
}

// Function to copy folder
async function copyFolder(
  source,
  destinationBase,
  instanceNumber,
  instanceTimestamp
) {
  try {
    const destinationFolderName = `${instanceNumber}_instance_${instanceTimestamp}`;
    const destination = path.join(destinationBase, destinationFolderName);

    // Ensure the destination folder exists
    await mkdir(destination, { recursive: true });

    const items = await readdir(source);
    for (const item of items) {
      const sourceItem = path.join(source, item);
      const destinationItem = path.join(destination, item);

      const itemStat = await stat(sourceItem);
      if (itemStat.isDirectory()) {
        await copyFolder(
          sourceItem,
          destination,
          instanceNumber,
          instanceTimestamp
        );
      } else {
        await copyFile(sourceItem, destinationItem);
      }
    }

    const destinationSettingsPath = path.join(destination, "settings.json");
    await updateSettings(destinationSettingsPath, destinationFolderName);

    console.log(
      `Contents of '${path.basename(source)}' copied to: ${destination}`
    );
  } catch (err) {
    console.error(`Error copying folder: ${err.message}`, err);
  }
}

// Watch for changes in the source settings.json
function watchSettingsFile(sourceSettingsPath, sourceFolder, destinationBase) {
  let instanceCounter = 1; // Counter for instances
  fs.watchFile(sourceSettingsPath, { interval: 100 }, async (curr, prev) => {
    if (curr.mtime !== prev.mtime) {
      console.log("Detected changes in settings.json");
      try {
        const instanceTimestamp = new Date()
          .toISOString()
          .replace("T", "_")
          .replace(/:/g, "-")
          .split(".")[0];

        await copyFolder(
          sourceFolder,
          destinationBase,
          instanceCounter,
          instanceTimestamp
        );
        instanceCounter++; // Increment the instance counter
      } catch (err) {
        console.error(`Error during file copy: ${err.message}`, err);
      }
    }
  });
}

// Run the copy operation
(async () => {
  try {
    const sessionFolder = path.join(downloadsFolder, `Session_${timestamp}`);
    await mkdir(sessionFolder, { recursive: true });

    const currentMapId = await extractCurrentMapId(settingsPath);
    const sourceFolder = path.join(basePath, "data", "maps", currentMapId);
    const sourceSettingsPath = path.join(sourceFolder, "settings.json");

    // Update research settings with the session folder name
    await updateResearchSettings(`Session_${timestamp}`);

    // Initial copy
    await copyFolder(sourceFolder, sessionFolder, 0, timestamp);
    watchSettingsFile(sourceSettingsPath, sourceFolder, sessionFolder);
  } catch (err) {
    console.error(`Error: ${err.message}`, err);
  }
})();

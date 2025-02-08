const fs = require("fs");
const path = require("path");
const { mkdir, copyFile, readdir, stat } = require("fs/promises");

const basePath = path.resolve(__dirname, ".."); // Public path
const settingsPath = path.join(basePath, "..", "data", "settings.json"); // settings of currentMapId
const researchSettingsPath = path.join(basePath, "research", "settings.json"); // settings of recording
const downloadsFolder = path.join(basePath, "research", "downloads");
const savedFolder = path.join(basePath, "research", "saved");
const sessionFolder = path.join(downloadsFolder, "session");

let mapSettingsWatcher = null;
let isWatchingMapSettings = false;
let recording = false;
const debounceTimers = {}; // Debounce timers for map settings

// Function to get a timestamp
function getTimestamp() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${hours}_${minutes}_${seconds}`;
}

// Function to check recording status and currentMapId
function shouldRecord(currentMapId) {
  return recording && currentMapId !== null;
}

// Ensure downloads and session folders exist
async function ensureFoldersExist() {
  try {
    // Ensure the downloads folder exists
    await mkdir(downloadsFolder, { recursive: true });
    await mkdir(savedFolder, { recursive: true });

    // Ensure the session folder exists
    await mkdir(sessionFolder, { recursive: true });
  } catch (err) {
    console.error(`Error ensuring folders exist: ${err.message}`);
  }
}

async function handleMapSettingsChange(mapFolder) {
  const iterationFolder = path.join(
    sessionFolder,
    `Iteration_${getTimestamp()}`
  );

  // Copy the folder contents
  await copyFolder(mapFolder, iterationFolder);

  // Update the iteration's settings.json `id` field
  const iterationSettingsPath = path.join(iterationFolder, "settings.json");
  await updateIterationSettings(
    iterationSettingsPath,
    path.basename(iterationFolder)
  );
}

// Function to update the `id` field in the iteration's settings.json file
async function updateIterationSettings(iterationSettingsPath, newId) {
  try {
    const data = JSON.parse(fs.readFileSync(iterationSettingsPath, "utf-8"));
    data.id = newId;

    fs.writeFileSync(
      iterationSettingsPath,
      JSON.stringify(data, null, 2),
      "utf-8"
    );
  } catch (err) {
    console.error(`Error updating settings.json: ${err.message}`, err);
  }
}

// Function to copy data to the session folder for each iteration
async function copyFolder(source, destination) {
  try {
    await mkdir(destination, { recursive: true });

    const items = await readdir(source);
    for (const item of items) {
      const sourceItem = path.join(source, item);
      const destinationItem = path.join(destination, item);

      const itemStat = await stat(sourceItem);
      if (itemStat.isDirectory()) {
        await copyFolder(sourceItem, destinationItem);
      } else {
        await copyFile(sourceItem, destinationItem);
      }
    }
  } catch (err) {
    console.error(`Error copying folder: ${err.message}`);
  }
}

// Function to start watching the map-specific settings file
function startWatchingMapSettings(currentMapId) {
  if (!currentMapId) return;

  const mapFolder = path.join(basePath, "..", "data", "maps", currentMapId);
  const mapSettingsPath = path.join(mapFolder, "settings.json");

  mapSettingsWatcher = fs.watch(mapSettingsPath, (eventType) => {
    if (eventType === "change" && shouldRecord(currentMapId)) {
      if (debounceTimers[currentMapId]) {
        clearTimeout(debounceTimers[currentMapId]);
      }
      debounceTimers[currentMapId] = setTimeout(async () => {
        handleMapSettingsChange(mapFolder);
      }, 100); // 100ms debounce delay
    }
  });
  isWatchingMapSettings = true;
}

// Function to stop watching the map-specific settings file
function stopWatchingMapSettings() {
  if (isWatchingMapSettings && mapSettingsWatcher) {
    console.log("Stopping watching map-specific settings.json...");
    mapSettingsWatcher.close();
    mapSettingsWatcher = null;
    isWatchingMapSettings = false;
  }
}

// Function to handle changes in the research settings file
function watchResearchSettingsFile() {
  let previousRecordingState = null;

  fs.watch(researchSettingsPath, async (eventType) => {
    if (eventType === "change") {
      try {
        const researchSettings = JSON.parse(
          fs.readFileSync(researchSettingsPath, "utf-8")
        );
        const recordingState = researchSettings.recording;

        if (recordingState !== previousRecordingState) {
          recording = recordingState === "recording";
          previousRecordingState = recordingState;

          const mainSettings = JSON.parse(
            fs.readFileSync(settingsPath, "utf-8")
          );
          const currentMapId = mainSettings.currentMapId;

          if (shouldRecord(currentMapId)) {
            startWatchingMapSettings(currentMapId);
          } else {
            stopWatchingMapSettings();
          }
        }
      } catch (err) {
        console.error(
          `Error reading or parsing ${researchSettingsPath}: ${err.message}`
        );
      }
    }
  });
}

// Function to watch the main settings file
function watchMainSettingsFile() {
  let previousMapId = null;

  fs.watch(settingsPath, async (eventType) => {
    if (eventType === "change") {
      try {
        const mainSettings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
        const currentMapId = mainSettings.currentMapId;

        if (currentMapId !== previousMapId) {
          if (shouldRecord(currentMapId)) {
            stopWatchingMapSettings();
            startWatchingMapSettings(currentMapId);
          } else {
            stopWatchingMapSettings();
          }
          previousMapId = currentMapId;
        }
      } catch (err) {
        console.error(
          `Error reading or parsing ${settingsPath}: ${err.message}`
        );
      }
    }
  });
}

// Initialize the script
(async () => {
  try {
    console.log("Starting file monitoring...");

    // Set initial state: currentMapId = null, recording = "stopped"
    const mainSettings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    mainSettings.currentMapId = null;
    fs.writeFileSync(
      settingsPath,
      JSON.stringify(mainSettings, null, 2),
      "utf-8"
    );

    const researchSettings = JSON.parse(
      fs.readFileSync(researchSettingsPath, "utf-8")
    );
    researchSettings.recording = "stopped";
    fs.writeFileSync(
      researchSettingsPath,
      JSON.stringify(researchSettings, null, 2),
      "utf-8"
    );

    await ensureFoldersExist(); // Ensure folders are in place
    watchResearchSettingsFile();
    watchMainSettingsFile();

    recording = researchSettings.recording === "recording";
    const currentMapId = mainSettings.currentMapId;

    if (shouldRecord(currentMapId)) {
      startWatchingMapSettings(currentMapId);
    }
  } catch (err) {
    console.error(`Error initializing script: ${err.message}`);
  }
})();

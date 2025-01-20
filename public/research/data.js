const fs = require("fs");
const path = require("path");
const { mkdir, copyFile, readdir, stat } = require("fs/promises");
const { initialize } = require("../../server/database");

const basePath = path.resolve(__dirname, "..");
const settingsPath = path.join(basePath, "..", "data", "settings.json");
const researchSettingsPath = path.join(basePath, "research", "settings.json");
const downloadsFolder = path.join(basePath, "research", "downloads");

let mapSettingsWatcher = null;
let isWatchingMapSettings = false;
const sessionCounters = {};
const debounceTimers = {}; // Debounce timers for map settings

let db;

async function initializeDatabase() {
  try {
    db = await initialize({ dataPath: path.join(basePath, "..", "data") });
    console.log("Database initialized and migrations run.");
  } catch (err) {
    console.error("Error initializing the database:", err);
  }
}

// Function to get a timestamp
function getTimestamp() {
  const options = {
    timeZone: "America/New_York", // Set to Eastern Time (New York)
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false, // Use 24-hour format
  };

  const localTime = new Date().toLocaleString("en-US", options);

  return localTime
    .replace(/[/, ]/g, "_") // Replace slashes and spaces with underscores
    .replace(/:/g, "-"); // Replace colons with dashes
}

// Function to update the research settings.json file
async function updateResearchSettings(sessionFolderName) {
  try {
    if (!db) {
      console.error("Database is not initialized.");
      return;
    }

    // Check if the session already exists in the database
    const existingSession = await db.get('SELECT * FROM sessions WHERE name = ?', sessionFolderName);
    
    if (existingSession) {
      console.log(`Session '${sessionFolderName}' already exists in the database.`);
      return;
    }

    const now = Date.now();
    await db.run('INSERT INTO sessions (name, created_at, updated_at) VALUES (?, ?, ?)', sessionFolderName, now, now);

    console.log(`Added '${sessionFolderName}' to the database in the 'sessions' table.`);
  } catch (err) {
    console.error(`Error updating database: ${err.message}`, err);
  }
}

// Function to copy data to a unique folder in the session directory
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

    console.log(`Copied data from ${source} to ${destination}`);
  } catch (err) {
    console.error(`Error copying folder: ${err.message}`);
  }
}

// Function to update the `id` field in the settings.json file for each iteration
async function updateIterationSettings(iterationSettingsPath, newId) {
  try {
    const data = JSON.parse(fs.readFileSync(iterationSettingsPath, "utf-8"));
    data.id = newId; // Update the id field

    fs.writeFileSync(
      iterationSettingsPath,
      JSON.stringify(data, null, 2),
      "utf-8"
    );
    console.log(`Updated 'id' in settings.json to: ${newId}`);
  } catch (err) {
    console.error(`Error updating settings.json: ${err.message}`, err);
  }
}

// Function to handle copying data when `settings.json` changes in the map folder
async function handleMapSettingsChange(
  mapFolder,
  sessionBaseFolder,
  instanceCounter
) {
  const iterationFolder = path.join(
    sessionBaseFolder,
    `Iteration_${instanceCounter}`
  );
  console.log(
    `Detected change in map settings. Creating iteration: ${iterationFolder}`
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

// Function to start watching the map-specific settings file
function startWatchingMapSettings(currentMapId) {
  const mapFolder = path.join(basePath, "..", "data", "maps", currentMapId);
  const mapSettingsPath = path.join(mapFolder, "settings.json");
  const sessionBaseFolder = path.join(
    downloadsFolder,
    `Session_${getTimestamp()}`
  );
  sessionCounters[currentMapId] = 1; // Initialize counter for this session

  // Create the session base folder
  mkdir(sessionBaseFolder, { recursive: true })
    .then(async () => {
      console.log(`Created session base folder: ${sessionBaseFolder}`);

      // Update research/settings.json with the new session folder name
      await updateResearchSettings(path.basename(sessionBaseFolder));

      // Perform the initial copy
      await handleMapSettingsChange(
        mapFolder,
        sessionBaseFolder,
        sessionCounters[currentMapId]
      );
      sessionCounters[currentMapId]++; // Increment counter for the next iteration

      // Start watching the map settings
      mapSettingsWatcher = fs.watch(mapSettingsPath, (eventType) => {
        if (eventType === "change") {
          if (debounceTimers[currentMapId]) {
            clearTimeout(debounceTimers[currentMapId]);
          }
          debounceTimers[currentMapId] = setTimeout(async () => {
            await handleMapSettingsChange(
              mapFolder,
              sessionBaseFolder,
              sessionCounters[currentMapId]
            );
            sessionCounters[currentMapId]++; // Increment counter for each change
          }, 100); // 100ms debounce delay
        }
      });
      isWatchingMapSettings = true;
    })
    .catch((err) =>
      console.error(`Error creating session base folder: ${err.message}`)
    );
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

// Function to watch the main settings file
function watchMainSettingsFile() {
  let previousMapId = null;

  fs.watch(settingsPath, async (eventType) => {
    if (eventType === "change") {
      console.log("Detected changes in main settings.json...");
      try {
        const mainSettings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
        const currentMapId = mainSettings.currentMapId;

        if (currentMapId && currentMapId !== previousMapId) {
          // Stop watching the previous map settings if necessary
          stopWatchingMapSettings();

          // Start watching the new map settings
          startWatchingMapSettings(currentMapId);
        } else if (!currentMapId) {
          stopWatchingMapSettings();
        }

        previousMapId = currentMapId;
      } catch (err) {
        console.error(
          `Error reading or parsing ${settingsPath}: ${err.message}`
        );
      }
    }
  });

  console.log(`Watching main settings file: ${settingsPath}`);
}

// Initialize the script
(async () => {
  try {
    console.log("Starting file monitoring...");

    await initializeDatabase();

    // Start watching the main settings file
    watchMainSettingsFile();

    // Initial check to start or stop watching map-specific settings
    const mainSettings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    const currentMapId = mainSettings.currentMapId;
    if (currentMapId) {
      startWatchingMapSettings(currentMapId);
    }
  } catch (err) {
    console.error(`Error initializing script: ${err.message}`);
  }
})();

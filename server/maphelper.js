const fs = require("fs-extra");
const path = require("path");

async function getMapsFromDisk() {
  const baseMapsPath = path.join(process.cwd(), "data", "maps");
  try {
    const folders = await fs.readdir(baseMapsPath); //Reads the maps folder to make sure up-to-date info is returned
    const mapFolders = await Promise.all(
      folders.map(async (folder) => {
        const folderPath = path.join(baseMapsPath, folder);
        const stats = await fs.stat(folderPath);
        return stats.isDirectory() ? folder : null;
      })
    );
    return mapFolders.filter(Boolean);
  } catch (error) {
    console.error("Error reading maps folder:", error);
    return [];
  }
}

module.exports = { getMapsFromDisk };

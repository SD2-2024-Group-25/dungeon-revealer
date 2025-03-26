// server/routes/zoom.ts
import express from "express";
import path from "path";
import fs from "fs-extra"; // optional, for ensuring directories exist
import { downloadZoomRecordings } from "../zoomDownloader"; // or wherever your script lives

const router = express.Router();

router.post("/download", async (req, res) => {
  try {
    const {
      accountId,
      clientId,
      clientSecret,
      recordingYear,
      monthFrom,
      monthTo,
      userEmail,
    } = req.body;

    // If you want to ensure the directory exists, do so here:
    const downloadPath = path.join(
      __dirname,
      "..", // go up from 'routes' directory to 'server'
      "..", // go up again to project root (adjust as needed!)
      "public",
      "research",
      "downloads",
      "zoom"
    );
    fs.ensureDirSync(downloadPath);

    deleteFolderContents(downloadPath);

    // Call your script
    const result = await downloadZoomRecordings({
      accountId,
      clientId,
      clientSecret,
      recordingYear: parseInt(recordingYear, 10),
      monthFrom: parseInt(monthFrom, 10),
      monthTo: parseInt(monthTo, 10),
      userEmail,
      downloadDir: downloadPath,
    });

    return res.json({ success: true, data: result });
  } catch (err: any) {
    console.error("Zoom download error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 1) GET /api/zoom/list-files
router.get("/list-files", async (req, res) => {
  try {
    const zoomDir = path.join(
      __dirname,
      "..",
      "..",
      "public",
      "research",
      "downloads",
      "zoom"
    );

    // If the folder doesn't exist yet, return an empty list
    if (!fs.existsSync(zoomDir)) {
      return res.json({ files: [] });
    }

    // Filter out directories, only list actual files
    const allItems = fs.readdirSync(zoomDir);
    const files = allItems.filter((item) => {
      const itemPath = path.join(zoomDir, item);
      return fs.statSync(itemPath).isFile();
    });

    res.json({ files });
  } catch (err: any) {
    console.error("Error listing zoom files:", err);
    res.status(500).json({ error: err.message });
  }
});

// 2) POST /api/zoom/copy-files
router.post("/copy-files", async (req, res) => {
  try {
    const { selectedFiles } = req.body;
    if (!selectedFiles || !Array.isArray(selectedFiles)) {
      return res.status(400).json({ error: "No selected files provided" });
    }

    // Source directory: where Zoom downloads are stored
    const zoomDir = path.join(
      __dirname,
      "..",
      "..",
      "public",
      "research",
      "downloads",
      "zoom"
    );

    // Destination folder(s). You mentioned copying them to "public/research/zoom"
    // and also "public/research/saved". Adjust as needed:
    const finalZoomDir = path.join(
      __dirname,
      "..",
      "..",
      "public",
      "research",
      "zoom"
    );
    // const finalSavedDir = path.join(
    //   __dirname,
    //   "..",
    //   "..",
    //   "public",
    //   "research",
    //   "saved"
    // );

    // Ensure directories exist
    fs.ensureDirSync(finalZoomDir);
    // fs.ensureDirSync(finalSavedDir);
    deleteFolderContents(finalZoomDir);

    // Copy each selected file
    for (const fileName of selectedFiles) {
      const srcPath = path.join(zoomDir, fileName);

      // Copy to finalZoomDir
      const destZoom = path.join(finalZoomDir, fileName);
      fs.copyFileSync(srcPath, destZoom);

      // Also copy to finalSavedDir
      //   const destSaved = path.join(finalSavedDir, fileName);
      //   fs.copyFileSync(srcPath, destSaved);
    }

    res.json({ success: true, message: "Selected files copied successfully." });
  } catch (err: any) {
    console.error("Error copying zoom files:", err);
    res.status(500).json({ error: err.message });
  }
});

function deleteFolderContents(folderPath: any) {
  if (fs.existsSync(folderPath)) {
    fs.readdirSync(folderPath).forEach((file) => {
      const curPath = path.join(folderPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        fs.rmSync(curPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(curPath);
      }
    });
  }
}

export default router;

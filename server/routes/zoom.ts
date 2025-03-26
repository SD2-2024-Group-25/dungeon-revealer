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

export default router;

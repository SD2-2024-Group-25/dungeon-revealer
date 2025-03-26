// server/scripts/zoomDownloader.js

const axios = require("axios");
const fs = require("fs");
const path = require("path");

/**
 * Helper to get the first & last day of a month in YYYY-MM-DD format
 */
function getFirstAndLastDay(year, month) {
  if (month < 1 || month > 12) {
    throw new Error("Month should be between 1 and 12.");
  }
  const fromDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const toDate = `${year}-${String(month).padStart(2, "0")}-${String(
    lastDay
  ).padStart(2, "0")}`;
  return { fromDate, toDate };
}

/**
 * Retrieve an OAuth access token for Zoom
 */
async function getAccessToken(accountId, clientId, clientSecret) {
  const baseUrl = "https://zoom.us/oauth/token";
  const authString = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  const headers = {
    Authorization: `Basic ${authString}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };

  const data = new URLSearchParams({
    grant_type: "account_credentials",
    account_id: accountId,
  });

  try {
    const response = await axios.post(baseUrl, data, { headers });
    return response.data.access_token;
  } catch (error) {
    console.error(
      "Failed to get access token:",
      error.response ? error.response.data : error.message
    );
    throw new Error("Failed to get access token. Check your Zoom credentials.");
  }
}

/**
 * Fetch all Zoom users (paginated) under the given account
 */
async function getAllUsers(accessToken) {
  const baseUrl = "https://api.zoom.us/v2/users";
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  let usersList = [];
  let nextPageToken = null;

  do {
    const params = {
      page_size: 300,
      next_page_token: nextPageToken,
    };

    try {
      const response = await axios.get(baseUrl, { headers, params });
      usersList = usersList.concat(response.data.users);
      nextPageToken = response.data.next_page_token;
    } catch (error) {
      console.error(
        "Failed to fetch users list:",
        error.response ? error.response.data : error.message
      );
      throw new Error("Failed to fetch users list. Check your access token.");
    }
  } while (nextPageToken);

  return usersList;
}

/**
 * Fetch all recordings for a single user within a specific month/year
 */
async function getAllRecordings(year, month, accessToken, userId) {
  const { fromDate, toDate } = getFirstAndLastDay(year, month);
  const baseUrl = `https://api.zoom.us/v2/users/${userId}/recordings`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  let recordingsList = [];
  let nextPageToken = null;

  do {
    const params = {
      page_size: 300,
      from: fromDate,
      to: toDate,
      next_page_token: nextPageToken,
    };

    try {
      const response = await axios.get(baseUrl, { headers, params });
      recordingsList = recordingsList.concat(response.data.meetings);
      nextPageToken = response.data.next_page_token;
    } catch (error) {
      console.error(
        `Failed to fetch recordings for user ${userId}:`,
        error.response ? error.response.data : error.message
      );
      throw new Error(
        `Failed to fetch recordings for user ${userId}. Check your access token.`
      );
    }
  } while (nextPageToken);

  return recordingsList;
}

/**
 * Convert a GMT date-time string to a filename-friendly format
 */
function formatGmtDateTime(gmtDateTime) {
  const date = new Date(gmtDateTime);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

/**
 * Convert a relative time in seconds to a "HH:MM:SS.mmm" string in GMT
 */
function convertToGmtTime(relativeTime, meetingStartTime) {
  const meetingStart = new Date(meetingStartTime);
  const gmtTime = new Date(meetingStart.getTime() + relativeTime * 1000);
  return gmtTime.toISOString().slice(11, 23); // e.g. "HH:MM:SS.mmm"
}

/**
 * Convert a "HH:MM:SS.mmm" string to total seconds
 */
function parseTimeToSeconds(timeString) {
  const [hh, mm, ssmmm] = timeString.split(":");
  const [ss, mmm] = ssmmm.split(".");
  return (
    parseInt(hh) * 3600 +
    parseInt(mm) * 60 +
    parseInt(ss) +
    parseFloat(`0.${mmm}`)
  );
}

/**
 * Modify a transcript file in .vtt format so that its timestamps are in GMT
 */
function modifyTranscriptFile(filePath, meetingStartTime) {
  const transcriptContent = fs.readFileSync(filePath, "utf8");
  const lines = transcriptContent.split("\n");
  let modifiedContent = "";

  for (const line of lines) {
    const timestampRegex =
      /(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})/;
    const match = line.match(timestampRegex);

    if (match) {
      const [_, relativeStart, relativeEnd] = match;
      const startTimeInSeconds = parseTimeToSeconds(relativeStart);
      const endTimeInSeconds = parseTimeToSeconds(relativeEnd);
      const gmtStartTime = convertToGmtTime(
        startTimeInSeconds,
        meetingStartTime
      );
      const gmtEndTime = convertToGmtTime(endTimeInSeconds, meetingStartTime);
      modifiedContent +=
        line.replace(timestampRegex, `${gmtStartTime} --> ${gmtEndTime}`) +
        "\n";
    } else {
      modifiedContent += line + "\n";
    }
  }

  fs.writeFileSync(filePath, modifiedContent, "utf8");
  console.log(`Modified transcript file: ${filePath}`);
}

/**
 * Download a single Zoom recording file (MP4 or TRANSCRIPT)
 */
async function downloadZoomRecording(
  accessToken,
  recordingName,
  downloadUrl,
  fileType,
  meetingStartTime,
  downloadDir = "../pubilc/research/downloads/zoom"
) {
  const gmtDateTime = formatGmtDateTime(meetingStartTime);
  const filename = `${gmtDateTime}_${recordingName.replace(/\W+/g, "_")}`;

  let filePath;
  if (fileType === "MP4") {
    filePath = path.join(downloadDir, `${filename}.mp4`);
  } else if (fileType === "TRANSCRIPT") {
    filePath = path.join(downloadDir, `${filename}.vtt`);
  } else {
    console.error(`Unsupported file type: ${fileType}`);
    return false;
  }

  // Skip if already downloaded
  if (fs.existsSync(filePath)) {
    console.log(`Recording ${filePath} exists, skipped.`);
    return true;
  } else {
    console.log(`Recording ${filePath} does not exist. Downloading...`);
  }

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  try {
    const response = await axios.get(downloadUrl, {
      headers,
      responseType: "stream",
    });
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    console.log(`Recording downloaded successfully as ${filePath}.`);

    // If it’s a transcript, fix its timestamps
    if (fileType === "TRANSCRIPT") {
      modifyTranscriptFile(filePath, meetingStartTime);
    }

    return true;
  } catch (error) {
    console.error(`Failed to download recording: ${filePath}`, error.message);
    return false;
  }
}

/**
 * Main function to download Zoom recordings, using user-supplied input
 *
 * @param {Object} options
 * @param {string} options.accountId     - Zoom Account ID
 * @param {string} options.clientId      - Zoom Client ID
 * @param {string} options.clientSecret  - Zoom Client Secret
 * @param {number} options.recordingYear - e.g. 2023
 * @param {number} options.monthFrom     - e.g. 1
 * @param {number} options.monthTo       - e.g. 3  (non-inclusive in this script)
 * @param {string} [options.userEmail] - array of user emails to limit downloads
 * @param {string} [options.downloadDir] - path to store the downloaded files
 */
async function downloadZoomRecordings(options) {
  const {
    accountId,
    clientId,
    clientSecret,
    recordingYear,
    monthFrom,
    monthTo,
    // changed from usersFilter -> userEmail
    userEmail,
    downloadDir = "../public/research/downloads/zoom",
  } = options;

  // Basic validation
  if (!accountId || !clientId || !clientSecret) {
    throw new Error(
      "Missing Zoom credentials (accountId, clientId, clientSecret)."
    );
  }
  if (!recordingYear || !monthFrom || !monthTo) {
    throw new Error(
      "Missing or invalid date parameters (recordingYear, monthFrom, monthTo)."
    );
  }
  if (!userEmail) {
    throw new Error("Missing userEmail (the Zoom email).");
  }

  // 1) Get access token
  const accessToken = await getAccessToken(accountId, clientId, clientSecret);

  // 2) Get all users & find the single user whose email matches
  const usersList = await getAllUsers(accessToken);
  const targetUser = usersList.find(
    (u) => u.email.toLowerCase() === userEmail.toLowerCase()
  );
  if (!targetUser) {
    throw new Error(`No Zoom user found with email "${userEmail}".`);
  }

  // 3) Gather recordings for that one user in the given range
  const userId = targetUser.id;
  const allRecordings = [];

  // For each month in [monthFrom, monthTo)
  for (let m = monthFrom; m < monthTo; m++) {
    const monthlyRecordings = await getAllRecordings(
      recordingYear,
      m,
      accessToken,
      userId
    );
    allRecordings.push(...monthlyRecordings);
  }

  // 4) Download each file
  for (const recording of allRecordings) {
    const recordingName = recording.topic;
    const recordingFiles = recording.recording_files;
    const meetingStartTime = recording.start_time;

    for (const file of recordingFiles) {
      // skip audio_only if you only want MP4 + transcript
      if (file.recording_type === "audio_only") {
        continue;
      }

      const recordingNameWithId = `${recordingName}_${file.id}`;
      const downloadUrl = file.download_url;
      const fileType = file.file_type; // "MP4" or "TRANSCRIPT" or "M4A", etc.

      // Check if the file still exists before downloading
      try {
        const headResp = await axios.head(downloadUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (headResp.status === 200) {
          await downloadZoomRecording(
            accessToken,
            recordingNameWithId,
            downloadUrl,
            fileType,
            meetingStartTime,
            downloadDir
          );
        } else {
          console.log(
            `Recording ${recordingNameWithId} no longer exists, skipped.`
          );
        }
      } catch (error) {
        console.error(
          `Failed to check recording ${recordingNameWithId}:`,
          error.message
        );
      }
    }
  }

  return { success: true, message: "Zoom recordings downloaded successfully." };
}

// Export the main function so your backend can call it as needed
module.exports = {
  downloadZoomRecordings,
};

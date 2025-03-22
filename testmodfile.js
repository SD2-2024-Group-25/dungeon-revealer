require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Environment variables
const ACCOUNT_ID = process.env.ZOOM_ACCOUNT_ID;
const CLIENT_ID = process.env.ZOOM_CLIENT_ID;
const CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET;
const RECORDING_YEAR = parseInt(process.env.ZOOM_RECORDING_YEAR, 10);
const RECORDING_MONTH_FROM = parseInt(process.env.ZOOM_RECORDING_MONTH_FROM, 10);
const RECORDING_MONTH_TO = parseInt(process.env.ZOOM_RECORDING_MONTH_TO, 10);
const USERS_FILTER = process.env.ZOOM_USERS_FILTER ? process.env.ZOOM_USERS_FILTER.split(',') : null;

// Helper function to get the first and last day of a month
function getFirstAndLastDay(year, month) {
  if (month < 1 || month > 12) {
    throw new Error('Month should be between 1 and 12.');
  }

  const fromDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const toDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  return { fromDate, toDate };
}

// Function to get the Zoom access token
async function getAccessToken(accountId, clientId, clientSecret) {
  const baseUrl = 'https://zoom.us/oauth/token';
  const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const headers = {
    Authorization: `Basic ${authString}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  const data = new URLSearchParams({
    grant_type: 'account_credentials',
    account_id: accountId,
  });

  try {
    const response = await axios.post(baseUrl, data, { headers });
    return response.data.access_token;
  } catch (error) {
    console.error('Failed to get access token:', error.response ? error.response.data : error.message);
    throw new Error('Failed to get access token. Check your account credentials.');
  }
}

// Function to get all users
async function getAllUsers(accessToken) {
  const baseUrl = 'https://api.zoom.us/v2/users';
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
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
      console.error('Failed to fetch users list:', error.response ? error.response.data : error.message);
      throw new Error('Failed to fetch users list. Check your access token.');
    }
  } while (nextPageToken);

  return usersList;
}

// Function to get all recordings for a user
async function getAllRecordings(year, month, accessToken, userId) {
  const { fromDate, toDate } = getFirstAndLastDay(year, month);
  const baseUrl = `https://api.zoom.us/v2/users/${userId}/recordings`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
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
      console.error(`Failed to fetch recordings for user ${userId}:`, error.response ? error.response.data : error.message);
      throw new Error(`Failed to fetch recordings for user ${userId}. Check your access token.`);
    }
  } while (nextPageToken);

  return recordingsList;
}

// Function to format the GMT date and time
function formatGmtDateTime(gmtDateTime) {
    const date = new Date(gmtDateTime);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  
    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
  }

// Function to convert relative time (in seconds) to GMT time
function convertToGmtTime(relativeTime, meetingStartTime) {
    const meetingStart = new Date(meetingStartTime);
    const gmtTime = new Date(meetingStart.getTime() + relativeTime * 1000);
    return gmtTime.toISOString().slice(11, 23); // Extract HH:MM:SS.mmm
}
  
// Helper function to convert HH:MM:SS.mmm to seconds
function parseTimeToSeconds(timeString) {
    const [hh, mm, ssmmm] = timeString.split(':');
    const [ss, mmm] = ssmmm.split('.');
    return parseInt(hh) * 3600 + parseInt(mm) * 60 + parseInt(ss) + parseFloat(`0.${mmm}`);
}
  
// Function to modify the transcript file
function modifyTranscriptFile(filePath, meetingStartTime) {
    const transcriptContent = fs.readFileSync(filePath, 'utf8');
    const lines = transcriptContent.split('\n');
    let modifiedContent = '';
  
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
  
      // Check if the line contains a timestamp
      const timestampRegex = /(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})/;
      const match = line.match(timestampRegex);
  
      if (match) {
        // Extract relative start and end times
        const relativeStartTime = match[1];
        const relativeEndTime = match[2];
  
        // Convert relative times to seconds
        const startTimeInSeconds = parseTimeToSeconds(relativeStartTime);
        const endTimeInSeconds = parseTimeToSeconds(relativeEndTime);
  
        // Convert to GMT time
        const gmtStartTime = convertToGmtTime(startTimeInSeconds, meetingStartTime);
        const gmtEndTime = convertToGmtTime(endTimeInSeconds, meetingStartTime);
  
        // Replace the relative timestamps with GMT timestamps
        const modifiedLine = line.replace(timestampRegex, `${gmtStartTime} --> ${gmtEndTime}`);
        modifiedContent += modifiedLine + '\n';
      } else {
        modifiedContent += line + '\n';
      }
    }
  
    // Write the modified content back to the file
    fs.writeFileSync(filePath, modifiedContent, 'utf8');
    console.log(`Modified transcript file: ${filePath}`);
}
  
// Function to download a Zoom recording
async function downloadZoomRecording(accessToken, recordingName, downloadUrl, fileType, meetingStartTime, downloadDir = './downloads') {
    const gmtDateTime = formatGmtDateTime(meetingStartTime);
    const filename = `${gmtDateTime}_${recordingName.replace(/\W+/g, '_')}`; // Replace non-alphanumeric characters with underscores
  
    // Add file extension based on file type
    let filePath;
    if (fileType === 'MP4') {
      filePath = path.join(downloadDir, `${filename}.mp4`);
    } else if (fileType === 'TRANSCRIPT') {
      filePath = path.join(downloadDir, `${filename}.vtt`); // Transcripts are usually in VTT format
    } else {
      console.error(`Unsupported file type: ${fileType}`);
      return false;
    }
  
    if (fs.existsSync(filePath)) {
      console.log(`Recording ${filePath} exists, skipped.`);
      return true;
    } else {
      console.log(`Recording ${filePath} does not exist.`);
    }
  
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
  
    try {
      const response = await axios.get(downloadUrl, { headers, responseType: 'stream' });
      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);
  
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
  
      console.log(`Recording downloaded successfully as ${filePath}.`);
  
      // If the file is a transcript, modify its timestamps
      if (fileType === 'TRANSCRIPT') {
        modifyTranscriptFile(filePath, meetingStartTime);
      }
  
      return true;
    } catch (error) {
      console.error(`Failed to download recording: ${filePath}`, error.message);
      return false;
    }
  }

// Main function
async function main() {
  if (!ACCOUNT_ID || !CLIENT_ID || !CLIENT_SECRET || !RECORDING_YEAR || !RECORDING_MONTH_FROM || !RECORDING_MONTH_TO) {
    throw new Error('Please set the ZOOM_* environment variables.');
  }

  console.log('Users filter:', USERS_FILTER);

  // Clear cache files if they exist
  if (fs.existsSync('users_list_cache.json')) {
    fs.unlinkSync('users_list_cache.json');
  }
  if (fs.existsSync('recordings_dict_cache.json')) {
    fs.unlinkSync('recordings_dict_cache.json');
  }

  const accessToken = await getAccessToken(ACCOUNT_ID, CLIENT_ID, CLIENT_SECRET);

  let usersList;
  if (fs.existsSync('users_list_cache.json')) {
    usersList = JSON.parse(fs.readFileSync('users_list_cache.json', 'utf8'));
  } else {
    usersList = await getAllUsers(accessToken);
    fs.writeFileSync('users_list_cache.json', JSON.stringify(usersList));
  }

  let recordingsList = {};
  if (fs.existsSync('recordings_dict_cache.json')) {
    recordingsList = JSON.parse(fs.readFileSync('recordings_dict_cache.json', 'utf8'));
  } else {
    for (const user of usersList) {
      if (!USERS_FILTER || USERS_FILTER.includes(user.email)) {
        const userId = user.id;
        recordingsList[userId] = [];

        for (let month = RECORDING_MONTH_FROM; month < RECORDING_MONTH_TO; month++) {
          recordingsList[userId] = recordingsList[userId].concat(
            await getAllRecordings(RECORDING_YEAR, month, accessToken, userId)
          );
        }
      }
    }
    fs.writeFileSync('recordings_dict_cache.json', JSON.stringify(recordingsList));
  }

  for (const userId in recordingsList) {
    const recordings = recordingsList[userId];
    for (const recording of recordings) {
      const recordingName = recording.topic;
      const recordingFiles = recording.recording_files;
      const meetingStartTime = recording.start_time; // Use the meeting start time
  
      for (const file of recordingFiles) {
        if (file.recording_type !== 'audio_only') {
          const recordingNameWithId = `${recordingName}_${file.id}`;
          const downloadUrl = file.download_url;
          const fileType = file.file_type;
  
          // Check if the recording still exists before downloading
          try {
            const response = await axios.head(downloadUrl, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (response.status === 200) {
              await downloadZoomRecording(accessToken, recordingNameWithId, downloadUrl, fileType, meetingStartTime);
            } else {
              console.log(`Recording ${recordingNameWithId} no longer exists, skipped.`);
            }
          } catch (error) {
            console.error(`Failed to check recording ${recordingNameWithId}:`, error.message);
          }
        }
      }
    }
  }
}

// Run the script
main().catch((error) => {
  console.error('Error:', error.message);
});
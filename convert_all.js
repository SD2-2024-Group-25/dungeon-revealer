const fs = require('fs');
const path = require('path');
const { parse } = require('json2csv');

const parentFolder = path.join(__dirname, 'parent_folder');

const outputCsvPath = path.join(parentFolder, 'all_tokens.csv');

const fields = [
    'source_folder',
    'id', 'x', 'y', 'radius', 'color', 'label',
    'isVisibleForPlayers', 'isMovableByPlayers',
    'isLocked', 'type', 'tokenImageId', 'rotation',
    'title', 'reference'
];

let allTokens = [];

// Function to extract numbers from folder name iteration_XX_XX_XX
function extractIterationNumbers(folderName) {
    const match = folderName.match(/Iteration_(\d+)_(\d+)_(\d+)/);
    if (match) {
        return match.slice(1).map(Number);
    }
    return [Infinity, Infinity, Infinity]; //default for mismatched name
}

function findSettingsJson(dir) {
    fs.readdir(dir, (err, files) => {
        if (err) {
            console.error('Error reading directory:', dir, err);
            return;
        }

        files.forEach(file => {
            const fullPath = path.join(dir, file);

            fs.stat(fullPath, (err, stats) => {
                if (err) {
                    console.error('Error reading file stats:', fullPath, err);
                    return;
                }

                if (stats.isDirectory()) {
                    findSettingsJson(fullPath);
                } else if (file === 'settings.json') {
                    convertJsonToCsv(fullPath);
                }
            });
        });
    });
}

function convertJsonToCsv(jsonFilePath) {
    fs.readFile(jsonFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading JSON file:', jsonFilePath, err);
            return;
        }

        try {
            const jsonData = JSON.parse(data);
            const tokens = jsonData.tokens || [];
            const folderName = path.basename(path.dirname(jsonFilePath));

            const tokensWithSource = tokens.map(token => ({
                source_folder: folderName,
                ...token
            }));

            allTokens = allTokens.concat(tokensWithSource);

            writeCsv();

        } catch (error) {
            console.error('Error parsing JSON:', jsonFilePath, error);
        }
    });
}

function writeCsv() {
    if (allTokens.length === 0) return;

    // Sort the data by iteration
    allTokens.sort((a, b) => {
        const aNumbers = extractIterationNumbers(a.source_folder);
        const bNumbers = extractIterationNumbers(b.source_folder);

        for (let i = 0; i < 3; i++) {
            if (aNumbers[i] !== bNumbers[i]) {
                return aNumbers[i] - bNumbers[i];
            }
        }
        return 0;
    });

    try {
        const csv = parse(allTokens, { fields });

        fs.writeFile(outputCsvPath, csv, (err) => {
            if (err) {
                console.error('Error writing CSV file:', outputCsvPath, err);
            } else {
                console.log(`✅ CSV file saved (sorted by folder name numerically): ${outputCsvPath}`);
            }
        });

    } catch (error) {
        console.error('Error converting to CSV:', error);
    }
}
findSettingsJson(parentFolder);

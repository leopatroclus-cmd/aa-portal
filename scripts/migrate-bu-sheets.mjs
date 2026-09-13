import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const credsPath = join(__dirname, '../../../Desktop/patroclus-626a313613cc.json');
const credentials = JSON.parse(readFileSync('/Users/patroclusbarbaroussis/Desktop/patroclus-626a313613cc.json', 'utf8'));

const SHEET_ID = '1rL0tyudLrOlRZN03oj8BLoMdsRpCxePb6DxTJ4w3_oc';

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

// Clean a cell value to a plain number or string
function clean(val) {
  if (!val || val.trim() === '' || val.trim() === '-' || val.trim() === '-   ') return '';
  return val.replace(/[$,\s]/g, '').replace(/R\s*/g, '').trim();
}

// Month → year mapping (FYE Apr 2025 – Mar 2026)
const MONTH_YEAR = {
  'April': 2025, 'May': 2025, 'June': 2025, 'July': 2025,
  'Aug': 2025, 'Sep': 2025, 'Oct': 2025, 'Nov': 2025, 'Dec': 2025,
  'Jan': 2026, 'Feb': 2026, 'Mar': 2026,
};

// BU definitions: which row indices (0-based) hold which fields
const BU_CONFIG = {
  'CONSOLIDATED OPS': {
    newName: 'CONSOLIDATED OPS_new',
    headers: ['Month', 'Year',
      'Airfreight Shipments', 'Airfreight Weight (kg)', 'Airfreight Profit (USD)',
      'Solution Shipments', 'Solution Weight (kg)', 'Solution Profit (USD)',
      'Ocean Shipments (INT)', 'Ocean Weight CBM (INT)', 'Ocean Profit USD (INT)',
      'Gulf Air Shipments (EA)', 'Gulf Air Weight kg (EA)', 'Gulf Air Profit USD (EA)',
      'Staff'],
    // row indices within the values array (0-based)
    rows: [7, 8, 9, 11, 12, 13, 15, 16, 17, 19, 20, 21, 23],
  },
  'AASA': {
    newName: 'AASA_new',
    headers: ['Month', 'Year',
      'Airfreight Shipments', 'Airfreight Weight (kg)', 'Airfreight Profit (USD)',
      'Solution Shipments', 'Solution Weight (kg)', 'Solution Profit (USD)',
      'Staff'],
    rows: [7, 8, 9, 11, 12, 13, 15],
  },
  'AAINT ': {
    newName: 'AAINT_new',
    headers: ['Month', 'Year',
      'Export Shipments', 'Export Weight (kg)', 'Export Profit (USD)',
      'Import Shipments', 'Import Weight (kg)', 'Import Profit (USD)',
      'Ocean Shipments', 'Ocean Weight (CBM)', 'Ocean Profit (USD)',
      'Staff'],
    rows: [7, 8, 9, 11, 12, 13, 15, 16, 17, 19],
  },
  'AAEA': {
    newName: 'AAEA_new',
    headers: ['Month', 'Year',
      'Airfreight Shipments', 'Airfreight Weight (kg)', 'Airfreight Profit (USD)',
      'Solution Shipments', 'Solution Weight (kg)', 'Solution Profit (USD)',
      'Gulf Air Shipments', 'Gulf Air Weight (kg)', 'Gulf Air Profit (USD)',
      'Staff'],
    rows: [7, 8, 9, 11, 12, 13, 15, 16, 17, 19],
  },
  'AAWN': {
    newName: 'AAWN_new',
    headers: ['Month', 'Year',
      'Airfreight Shipments', 'Airfreight Weight (kg)', 'Airfreight Profit (USD)',
      'Solution Shipments', 'Solution Weight (kg)', 'Solution Profit (USD)',
      'Staff'],
    rows: [7, 8, 9, 11, 12, 13, 15],
  },
  'AACN ': {
    newName: 'AACN_new',
    headers: ['Month', 'Year',
      'Airfreight Shipments', 'Airfreight Weight (kg)', 'Airfreight Profit (USD)',
      'Solution Shipments', 'Solution Weight (kg)', 'Solution Profit (USD)',
      'Staff'],
    rows: [7, 8, 9, 11, 12, 13, 15],
  },
  'AAMA ': {
    newName: 'AAMA_new',
    headers: ['Month', 'Year',
      'Airfreight Shipments', 'Airfreight Weight (kg)', 'Airfreight Profit (USD)',
      'Solution Shipments', 'Solution Weight (kg)', 'Solution Profit (USD)',
      'Staff'],
    rows: [7, 8, 9, 11, 12, 13, 15],
  },
};

async function readTab(tabName) {
  const range = `'${tabName}'!A1:O60`;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range,
  });
  return res.data.values || [];
}

async function createTab(title) {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [{
        addSheet: {
          properties: { title },
        },
      }],
    },
  });
  console.log(`  Created tab: ${title}`);
}

async function writeTab(tabName, rows) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `'${tabName}'!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: rows },
  });
}

async function migrate(tabName, config, values) {
  // Row 5 (0-based) = Month header row
  const monthRow = values[5] || [];
  // Columns 1–12 = April through March (indices 1-12), index 13 = Total (skip)
  const months = monthRow.slice(1, 13); // 12 months

  const dataRows = [config.headers];

  for (let colIdx = 0; colIdx < months.length; colIdx++) {
    const monthName = months[colIdx]?.trim();
    if (!monthName) continue;
    const year = MONTH_YEAR[monthName] || '';

    const rowData = [monthName, year];
    for (const rowIdx of config.rows) {
      const cell = values[rowIdx]?.[colIdx + 1]; // +1 to skip label column
      rowData.push(clean(cell));
    }
    dataRows.push(rowData);
  }

  return dataRows;
}

async function main() {
  // Get existing sheet names to avoid duplicates
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const existingTabs = new Set(meta.data.sheets.map(s => s.properties.title));

  for (const [tabName, config] of Object.entries(BU_CONFIG)) {
    console.log(`\nProcessing: ${tabName.trim()} → ${config.newName}`);

    // Read source data
    const values = await readTab(tabName);
    console.log(`  Read ${values.length} rows`);

    // Create new tab if it doesn't exist
    if (existingTabs.has(config.newName)) {
      console.log(`  Tab already exists, overwriting data...`);
    } else {
      await createTab(config.newName);
    }

    // Transform + write
    const newRows = await migrate(tabName, config, values);
    await writeTab(config.newName, newRows);
    console.log(`  Written ${newRows.length - 1} data rows + header`);
  }

  console.log('\n✅ All tabs migrated successfully.');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

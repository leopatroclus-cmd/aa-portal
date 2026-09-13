import { google } from 'googleapis';
import { readFileSync } from 'fs';

const credentials = JSON.parse(readFileSync('/Users/patroclusbarbaroussis/Desktop/patroclus-626a313613cc.json', 'utf8'));
const SHEET_ID = '1rL0tyudLrOlRZN03oj8BLoMdsRpCxePb6DxTJ4w3_oc';

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

// Fiscal year months + years
// Must match exactly what's stored in the _new tabs (mixed full/abbreviated)
const MONTHS = [
  ['April', 2025], ['May', 2025], ['June', 2025], ['July', 2025],
  ['Aug', 2025], ['Sep', 2025], ['Oct', 2025], ['Nov', 2025],
  ['Dec', 2025], ['Jan', 2026], ['Feb', 2026], ['Mar', 2026],
];

// SUMPRODUCT matching month (col A) + year (col B) for a given tab and column
// rowRef = e.g. "A2" (the cell containing the month in the consolidated row)
// yearRef = e.g. "B2"
function sp(tab, col, monthRef, yearRef) {
  return `IFERROR(SUMPRODUCT(('${tab}'!A$2:A$500=${monthRef})*('${tab}'!B$2:B$500=${yearRef})*IFERROR(VALUE('${tab}'!${col}$2:${col}$500),0)),0)`;
}

// Multiple tabs summed together for the same column
function spMany(tabs, col, monthRef, yearRef) {
  return tabs.map(t => sp(t, col, monthRef, yearRef)).join('+');
}

const STANDARD_TABS = ['AASA_new', 'AAWN_new', 'AACN_new', 'AAMA_new'];

// Build one row of formulas for a given spreadsheet row number (1-based)
function buildRow(rowNum, month, year) {
  const m = `A${rowNum}`;
  const y = `B${rowNum}`;

  // C: Airfreight Shipments — standard BUs (col C) + AAEA (col C) + AAINT export (col C) + AAINT import (col F)
  const airfreightShipments = `=${spMany(STANDARD_TABS, 'C', m, y)}+${sp('AAEA_new', 'C', m, y)}+${sp('AAINT_new', 'C', m, y)}+${sp('AAINT_new', 'F', m, y)}`;

  // D: Airfreight Weight (kg) — same mapping
  const airfreightWeight = `=${spMany(STANDARD_TABS, 'D', m, y)}+${sp('AAEA_new', 'D', m, y)}+${sp('AAINT_new', 'D', m, y)}+${sp('AAINT_new', 'G', m, y)}`;

  // E: Airfreight Profit (USD)
  const airfreightProfit = `=${spMany(STANDARD_TABS, 'E', m, y)}+${sp('AAEA_new', 'E', m, y)}+${sp('AAINT_new', 'E', m, y)}+${sp('AAINT_new', 'H', m, y)}`;

  // F: Solution Shipments — standard + AAEA (col F)
  const solutionShipments = `=${spMany(STANDARD_TABS, 'F', m, y)}+${sp('AAEA_new', 'F', m, y)}`;

  // G: Solution Weight (kg)
  const solutionWeight = `=${spMany(STANDARD_TABS, 'G', m, y)}+${sp('AAEA_new', 'G', m, y)}`;

  // H: Solution Profit (USD)
  const solutionProfit = `=${spMany(STANDARD_TABS, 'H', m, y)}+${sp('AAEA_new', 'H', m, y)}`;

  // I: Ocean Shipments (INT) — AAINT col I
  const oceanShipments = `=${sp('AAINT_new', 'I', m, y)}`;

  // J: Ocean Weight CBM (INT) — AAINT col J
  const oceanWeight = `=${sp('AAINT_new', 'J', m, y)}`;

  // K: Ocean Profit USD (INT) — AAINT col K
  const oceanProfit = `=${sp('AAINT_new', 'K', m, y)}`;

  // L: Gulf Air Shipments (EA) — AAEA col I
  const gulfShipments = `=${sp('AAEA_new', 'I', m, y)}`;

  // M: Gulf Air Weight kg (EA) — AAEA col J
  const gulfWeight = `=${sp('AAEA_new', 'J', m, y)}`;

  // N: Gulf Air Profit USD (EA) — AAEA col K
  const gulfProfit = `=${sp('AAEA_new', 'K', m, y)}`;

  // O: Staff — all BUs: standard (col I) + AAEA (col L) + AAINT (col L)
  const staff = `=${spMany(STANDARD_TABS, 'I', m, y)}+${sp('AAEA_new', 'L', m, y)}+${sp('AAINT_new', 'L', m, y)}`;

  return [
    month, year,
    airfreightShipments, airfreightWeight, airfreightProfit,
    solutionShipments, solutionWeight, solutionProfit,
    oceanShipments, oceanWeight, oceanProfit,
    gulfShipments, gulfWeight, gulfProfit,
    staff,
  ];
}

async function main() {
  console.log('Building CONSOLIDATED OPS_new with live formulas...');

  const header = [
    'Month', 'Year',
    'Airfreight Shipments', 'Airfreight Weight (kg)', 'Airfreight Profit (USD)',
    'Solution Shipments', 'Solution Weight (kg)', 'Solution Profit (USD)',
    'Ocean Shipments (INT)', 'Ocean Weight CBM (INT)', 'Ocean Profit USD (INT)',
    'Gulf Air Shipments (EA)', 'Gulf Air Weight kg (EA)', 'Gulf Air Profit USD (EA)',
    'Staff',
  ];

  const rows = [header];
  MONTHS.forEach(([month, year], i) => {
    rows.push(buildRow(i + 2, month, year)); // row 1 = header, data starts row 2
  });

  // Clear and rewrite the consolidated tab
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SHEET_ID,
    range: "'CONSOLIDATED OPS_new'!A1:Z100",
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: "'CONSOLIDATED OPS_new'!A1",
    valueInputOption: 'USER_ENTERED', // interprets = formulas
    requestBody: { values: rows },
  });

  console.log('✅ Done — CONSOLIDATED OPS_new now sums all BU _new tabs live.');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

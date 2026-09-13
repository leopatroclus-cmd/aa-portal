import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = "1rL0tyudLrOlRZN03oj8BLoMdsRpCxePb6DxTJ4w3_oc";

function getAuth() {
  const credsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credsJson) return null;
  try {
    return new google.auth.GoogleAuth({
      credentials: JSON.parse(credsJson),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  } catch {
    return null;
  }
}

// GET /api/bu-entries?tab=AASA_new&month=April&year=2025
// Returns the existing row's field values (columns C onwards)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tab = searchParams.get("tab");
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  if (!tab || !month || !year) {
    return NextResponse.json({ error: "tab, month, year required" }, { status: 400 });
  }

  const auth = getAuth();
  if (!auth) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${tab}'!A:Z`,
  });

  const rows = res.data.values || [];
  const match = rows.find(
    (r) => r[0]?.trim() === month.trim() && String(r[1]).trim() === String(year).trim()
  );

  if (!match) {
    return NextResponse.json({ found: false, fields: [] });
  }

  // Return columns C onwards (index 2+) as the field values
  return NextResponse.json({ found: true, fields: match.slice(2) });
}

// POST /api/bu-entries — append new row
export async function POST(req: NextRequest) {
  const auth = getAuth();
  if (!auth) return NextResponse.json({ error: "Write credentials not configured" }, { status: 503 });

  const { tab, month, year, fields } = await req.json();
  if (!tab || !month || !year || !Array.isArray(fields)) {
    return NextResponse.json({ error: "tab, month, year, fields required" }, { status: 400 });
  }

  const sheets = google.sheets({ version: "v4", auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `'${tab}'!A:Z`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[month, year, ...fields]] },
  });

  return NextResponse.json({ success: true });
}

// PUT /api/bu-entries — update existing row in place
export async function PUT(req: NextRequest) {
  const auth = getAuth();
  if (!auth) return NextResponse.json({ error: "Write credentials not configured" }, { status: 503 });

  const { tab, month, year, fields } = await req.json();
  if (!tab || !month || !year || !Array.isArray(fields)) {
    return NextResponse.json({ error: "tab, month, year, fields required" }, { status: 400 });
  }

  const sheets = google.sheets({ version: "v4", auth });

  // Find the row index
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${tab}'!A:A`,
  });

  const monthCol = res.data.values || [];
  let rowIndex = -1;

  // Also fetch year column to match both
  const resB = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${tab}'!B:B`,
  });
  const yearCol = resB.data.values || [];

  for (let i = 0; i < monthCol.length; i++) {
    if (
      monthCol[i]?.[0]?.trim() === month.trim() &&
      String(yearCol[i]?.[0]).trim() === String(year).trim()
    ) {
      rowIndex = i + 1; // 1-based
      break;
    }
  }

  if (rowIndex === -1) {
    // Row not found — append instead
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `'${tab}'!A:Z`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[month, year, ...fields]] },
    });
    return NextResponse.json({ success: true, action: "appended" });
  }

  // Update in place
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `'${tab}'!A${rowIndex}:Z${rowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[month, year, ...fields]] },
  });

  return NextResponse.json({ success: true, action: "updated" });
}

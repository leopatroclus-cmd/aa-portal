import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = "1rL0tyudLrOlRZN03oj8BLoMdsRpCxePb6DxTJ4w3_oc";

export async function POST(req: NextRequest) {
  const credsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credsJson) {
    return NextResponse.json(
      { error: "Write credentials not configured" },
      { status: 503 }
    );
  }

  let credentials: object;
  try {
    credentials = JSON.parse(credsJson);
  } catch {
    return NextResponse.json({ error: "Invalid service account credentials" }, { status: 500 });
  }

  const body = await req.json();
  const { tab, month, year, fields } = body;
  // tab: e.g. "AASA_new", month: "April", year: 2026, fields: string[] of values in column order

  if (!tab || !month || !year || !Array.isArray(fields)) {
    return NextResponse.json({ error: "tab, month, year, and fields are required" }, { status: 400 });
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  const row = [month, year, ...fields];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `'${tab}'!A:Z`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });

  return NextResponse.json({ success: true });
}

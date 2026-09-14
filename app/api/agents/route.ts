import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = "10wxWr6jsmn7n7gSPfQpbJvH8OXEPR9AZv7IgxnIdbPk";

function getAuth(credsJson: string) {
  const credentials = JSON.parse(credsJson);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function buildRow(body: {
  country: string; city: string; company: string;
  network?: string; contactManager?: string; isPrimary?: boolean; emails?: string[];
}) {
  const { country, city, company, network, contactManager, isPrimary, emails = [] } = body;
  const emailCols = Array.from({ length: 8 }, (_, i) => emails[i] || "");
  return [
    country,
    city,
    company,
    network || "",
    contactManager || "",
    isPrimary ? "Primary Agent" : "",
    ...emailCols,
  ];
}

// ── POST: add new agent ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const credsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credsJson) return NextResponse.json({ error: "Write credentials not configured" }, { status: 503 });

  try {
    const body = await req.json();
    const { tab = "Global", country, city, company } = body;
    if (!country || !city || !company)
      return NextResponse.json({ error: "country, city, and company are required" }, { status: 400 });

    const sheets = google.sheets({ version: "v4", auth: getAuth(credsJson) });
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${tab}!A:N`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [buildRow(body)] },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/agents error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

// ── PUT: edit existing agent by sheet row ─────────────────────────────────
export async function PUT(req: NextRequest) {
  const credsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credsJson) return NextResponse.json({ error: "Write credentials not configured" }, { status: 503 });

  try {
    const body = await req.json();
    const { tab, sheetRow, country, city, company } = body;
    if (!tab || !sheetRow || !country || !city || !company)
      return NextResponse.json({ error: "tab, sheetRow, country, city, and company are required" }, { status: 400 });

    const sheets = google.sheets({ version: "v4", auth: getAuth(credsJson) });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${tab}!A${sheetRow}:N${sheetRow}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [buildRow(body)] },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PUT /api/agents error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

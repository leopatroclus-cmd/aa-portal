import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = "10wxWr6jsmn7n7gSPfQpbJvH8OXEPR9AZv7IgxnIdbPk";

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
  const {
    tab = "Global",
    country,
    city,
    company,
    network,
    contactManager,
    isPrimary,
    emails = [],
  } = body;

  if (!country || !city || !company) {
    return NextResponse.json({ error: "country, city, and company are required" }, { status: 400 });
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  // Build row: A=country, B=city, C=company, D=network, E=contactManager, F=isPrimary, G–N=emails
  const emailCols = Array.from({ length: 8 }, (_, i) => emails[i] || "");
  const row = [
    country,
    city,
    company,
    network || "",
    contactManager || "",
    isPrimary ? "Primary Agent" : "",
    ...emailCols,
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${tab}!A:N`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });

  return NextResponse.json({ success: true });
}

import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

const SHEET_ID = "10wxWr6jsmn7n7gSPfQpbJvH8OXEPR9AZv7IgxnIdbPk";
const REVIEWS_TAB = "Reviews";

// ── POST: submit a review for an agent ───────────────────────────────────────
// Writes to the "Reviews" tab with columns:
//   A=Timestamp | B=Tab | C=Country | D=City | E=Company | F=Rating | G=Comment | H=Reviewer
export async function POST(req: NextRequest) {
  const credsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credsJson)
    return NextResponse.json({ error: "Write credentials not configured" }, { status: 503 });

  try {
    const body = await req.json();
    const { tab, country, city, company, rating, comment, reviewer } = body;

    if (!tab || !country || !city || !company || !rating)
      return NextResponse.json(
        { error: "tab, country, city, company, and rating are required" },
        { status: 400 }
      );

    if (typeof rating !== "number" || rating < 1 || rating > 5)
      return NextResponse.json({ error: "rating must be 1–5" }, { status: 400 });

    const credentials = JSON.parse(credsJson);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    // Column order matches existing Reviews tab:
    // A=Sheet | B=Country | C=City | D=CompanyName | E=Rating | F=ReviewerName | G=Comment | H=Timestamp
    const timestamp = new Date().toISOString();
    const row = [tab, country, city, company, rating, reviewer || "", comment || "", timestamp];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${REVIEWS_TAB}!A:H`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [row] },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/reviews error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

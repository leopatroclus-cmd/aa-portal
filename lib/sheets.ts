const API_KEY = process.env.GOOGLE_API_KEY;

const AGENT_SHEET_ID = "10wxWr6jsmn7n7gSPfQpbJvH8OXEPR9AZv7IgxnIdbPk";
const BU_SHEET_ID = "1rL0tyudLrOlRZN03oj8BLoMdsRpCxePb6DxTJ4w3_oc";

async function fetchRange(sheetId: string, range: string): Promise<string[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?key=${API_KEY}`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Sheets API error: ${res.status}`);
  const data = await res.json();
  return data.values || [];
}

// ─── Agents ──────────────────────────────────────────────────────────────────

export interface Agent {
  country: string;
  city: string;
  company: string;
  network: string;
  contactManager: string;
  isPrimary: boolean;
  emails: string[];
}

export async function fetchAgents(tab: "Global" | "Africa"): Promise<Agent[]> {
  const rows = await fetchRange(AGENT_SHEET_ID, `${tab}!A2:N2000`);
  return rows
    .filter((r) => r[0]?.trim())
    .map((r) => ({
      country: r[0]?.trim() || "",
      city: r[1]?.trim() || "",
      company: r[2]?.trim() || "",
      network: r[3]?.trim() || "",
      contactManager: r[4]?.trim() || "",
      isPrimary: r[5]?.trim().toLowerCase() === "primary agent",
      emails: [r[6], r[7], r[8], r[9], r[10], r[11], r[12], r[13]]
        .filter(Boolean)
        .map((e) => e.trim()),
    }));
}

// ─── BU Sheets ───────────────────────────────────────────────────────────────

export type BUType = "standard" | "international" | "east-africa" | "consolidated";

export interface BUSheet {
  name: string;       // original tab name (for legacy reads if needed)
  newTab: string;     // _new tab name
  label: string;
  type: BUType;
}

export const BU_SHEETS: BUSheet[] = [
  { name: "CONSOLIDATED OPS", newTab: "CONSOLIDATED OPS_new", label: "Consolidated",   type: "consolidated"  },
  { name: "AASA",             newTab: "AASA_new",             label: "South Africa",   type: "standard"      },
  { name: "AAINT ",           newTab: "AAINT_new",            label: "International",  type: "international" },
  { name: "AAEA",             newTab: "AAEA_new",             label: "East Africa",    type: "east-africa"   },
  { name: "AAWN",             newTab: "AAWN_new",             label: "West Africa",    type: "standard"      },
  { name: "AACN ",            newTab: "AACN_new",             label: "China",          type: "standard"      },
  { name: "AAMA ",            newTab: "AAMA_new",             label: "Morocco",        type: "standard"      },
];

// ─── BU Records (flat, multi-year) ───────────────────────────────────────────

export interface BURecord {
  month: string;          // e.g. "April", "Aug"
  year: number;
  sortKey: number;        // year * 100 + calendarMonth for chronological sort
  airfreightShipments: number;
  airfreightWeight: number;
  airfreightProfit: number;
  solutionShipments: number;
  solutionWeight: number;
  solutionProfit: number;
  oceanShipments: number;
  oceanWeight: number;
  oceanProfit: number;
  gulfShipments: number;
  gulfWeight: number;
  gulfProfit: number;
  staff: number;
  totalProfit: number;
}

// Month → calendar number (for sort key)
const MONTH_TO_CAL: Record<string, number> = {
  January: 1, Jan: 1,
  February: 2, Feb: 2,
  March: 3, Mar: 3,
  April: 4, Apr: 4,
  May: 5,
  June: 6, Jun: 6,
  July: 7, Jul: 7,
  August: 8, Aug: 8,
  September: 9, Sep: 9,
  October: 10, Oct: 10,
  November: 11, Nov: 11,
  December: 12, Dec: 12,
};

function parseNum(val: string | undefined): number {
  if (!val) return 0;
  const cleaned = val.replace(/[$,\s]/g, "").replace(/R\s*/g, "").trim();
  if (cleaned === "-" || cleaned === "") return 0;
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function toRecord(row: string[], type: BUType): BURecord {
  const month = row[0]?.trim() || "";
  const year = parseInt(row[1]) || 0;
  const calMonth = MONTH_TO_CAL[month] ?? 0;
  const n = (i: number) => parseNum(row[i]);

  let airfreightShipments = 0, airfreightWeight = 0, airfreightProfit = 0;
  let solutionShipments = 0, solutionWeight = 0, solutionProfit = 0;
  let oceanShipments = 0, oceanWeight = 0, oceanProfit = 0;
  let gulfShipments = 0, gulfWeight = 0, gulfProfit = 0;
  let staff = 0;

  if (type === "standard") {
    // C D E F G H I
    airfreightShipments = n(2); airfreightWeight = n(3); airfreightProfit = n(4);
    solutionShipments = n(5);  solutionWeight = n(6);  solutionProfit = n(7);
    staff = n(8);
  } else if (type === "international") {
    // C=export, D=expW, E=expP, F=import, G=impW, H=impP, I=ocean, J=ocW, K=ocP, L=staff
    airfreightShipments = n(2) + n(5); // export + import
    airfreightWeight    = n(3) + n(6);
    airfreightProfit    = n(4) + n(7);
    oceanShipments = n(8); oceanWeight = n(9); oceanProfit = n(10);
    staff = n(11);
  } else if (type === "east-africa") {
    // C D E F G H I J K L
    airfreightShipments = n(2); airfreightWeight = n(3); airfreightProfit = n(4);
    solutionShipments = n(5);  solutionWeight = n(6);  solutionProfit = n(7);
    gulfShipments = n(8); gulfWeight = n(9); gulfProfit = n(10);
    staff = n(11);
  } else if (type === "consolidated") {
    // C D E F G H I J K L M N O
    airfreightShipments = n(2); airfreightWeight = n(3); airfreightProfit = n(4);
    solutionShipments = n(5);  solutionWeight = n(6);  solutionProfit = n(7);
    oceanShipments = n(8); oceanWeight = n(9);  oceanProfit = n(10);
    gulfShipments = n(11); gulfWeight = n(12); gulfProfit = n(13);
    staff = n(14);
  }

  const totalProfit = airfreightProfit + solutionProfit + oceanProfit + gulfProfit;

  return {
    month, year,
    sortKey: year * 100 + calMonth,
    airfreightShipments, airfreightWeight, airfreightProfit,
    solutionShipments, solutionWeight, solutionProfit,
    oceanShipments, oceanWeight, oceanProfit,
    gulfShipments, gulfWeight, gulfProfit,
    staff, totalProfit,
  };
}

export async function fetchBURecords(bu: BUSheet): Promise<BURecord[]> {
  const rows = await fetchRange(BU_SHEET_ID, `'${bu.newTab}'!A2:P500`);
  return rows
    .filter((r) => r[0]?.trim() && r[1]?.trim()) // skip blank rows / header
    .map((r) => toRecord(r, bu.type))
    .sort((a, b) => a.sortKey - b.sortKey);
}

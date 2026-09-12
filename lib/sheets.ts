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

export interface BUSheet {
  name: string;
  label: string;
}

export const BU_SHEETS: BUSheet[] = [
  { name: "CONSOLIDATED OPS", label: "Consolidated" },
  { name: "AASA", label: "South Africa" },
  { name: "AAINT ", label: "International" },
  { name: "AAEA", label: "East Africa" },
  { name: "AAWN", label: "West Nigeria" },
  { name: "AACN ", label: "Central Nigeria" },
  { name: "AAMA ", label: "Morocco" },
];

const MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];

function parseNum(val: string | undefined): number {
  if (!val) return 0;
  const cleaned = val.replace(/[$,\s]/g, "").replace(/R\s*/g, "").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

export interface BUData {
  months: string[];
  shipments: number[];
  solutionShipments: number[];
  weight: number[];
  profit: number[];
  totalProfit: number[];
  staff: number;
  totals: {
    shipments: number;
    weight: number;
    profit: number;
    totalProfit: number;
  };
}

export async function fetchBUData(sheetName: string): Promise<BUData> {
  const rows = await fetchRange(BU_SHEET_ID, `'${sheetName}'!A1:O60`);

  function findRow(label: string, startAfter?: number): string[] | undefined {
    const start = startAfter ?? 0;
    for (let i = start; i < rows.length; i++) {
      if (rows[i][0]?.toLowerCase().includes(label.toLowerCase())) return rows[i];
    }
    return undefined;
  }

  const shipmentsRow = findRow("Total # of airfreight");
  const weightRow = findRow("Total chargeable weight");
  const profitRow = findRow("Total file profit (USD)");
  const staffRow = findRow("Number of staff");
  const totalProfitRow = findRow("Total file profit", 0);

  // find the actual "Total file profit" row (not "Total file profit (USD)")
  const totalFileProfitRow = (() => {
    for (const row of rows) {
      if (row[0]?.trim() === "Total file profit") return row;
    }
    return totalProfitRow;
  })();

  const extract = (row: string[] | undefined) =>
    MONTHS.map((_, i) => parseNum(row?.[i + 1]));

  const shipments = extract(shipmentsRow);
  const weight = extract(weightRow);
  const profit = extract(profitRow);
  const totalProfit = extract(totalFileProfitRow);

  const staffVal = staffRow ? parseNum(staffRow[staffRow.length - 1]) || parseNum(staffRow[1]) : 0;

  // Use last column as total (index 13 = column N)
  const getTotalCol = (row: string[] | undefined) => {
    if (!row) return 0;
    // last non-empty value
    for (let i = row.length - 1; i >= 1; i--) {
      const v = parseNum(row[i]);
      if (v !== 0) return v;
    }
    return 0;
  };

  return {
    months: MONTHS,
    shipments,
    solutionShipments: extract(findRow("Total # of solution")),
    weight,
    profit,
    totalProfit,
    staff: staffVal,
    totals: {
      shipments: getTotalCol(shipmentsRow),
      weight: getTotalCol(weightRow),
      profit: getTotalCol(profitRow),
      totalProfit: getTotalCol(totalFileProfitRow),
    },
  };
}

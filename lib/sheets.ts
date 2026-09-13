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
  { name: "AACN ", label: "China" },
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
  solutionWeight: number[];
  solutionProfit: number[];
  oceanShipments: number[];
  oceanWeight: number[];
  oceanProfit: number[];
  gulfShipments: number[];
  gulfWeight: number[];
  gulfProfit: number[];
  weight: number[];
  profit: number[];
  totalProfit: number[];
  staff: number;
  totals: {
    shipments: number;
    weight: number;
    profit: number;
    totalProfit: number;
    // Solution
    solutionShipments: number;
    solutionWeight: number;
    solutionProfit: number;
    // Ocean freight (INT only, 0 for others)
    oceanShipments: number;
    oceanWeight: number;
    oceanProfit: number;
    // Gulf Air (EA / Consolidated only, 0 for others)
    gulfShipments: number;
    gulfWeight: number;
    gulfProfit: number;
    // Derived
    profitPerShipment: number;
  };
}

export async function fetchBUData(sheetName: string): Promise<BUData> {
  const rows = await fetchRange(BU_SHEET_ID, `'${sheetName}'!A1:O60`);

  // Returns [row, rowIndex] or [undefined, -1]
  function findRowWithIdx(label: string, startAfter = 0): [string[] | undefined, number] {
    for (let i = startAfter; i < rows.length; i++) {
      if (rows[i]?.[0]?.toLowerCase().includes(label.toLowerCase())) {
        return [rows[i], i];
      }
    }
    return [undefined, -1];
  }

  const extract = (row: string[] | undefined) =>
    MONTHS.map((_, i) => parseNum(row?.[i + 1]));

  const getTotalCol = (row: string[] | undefined) => {
    if (!row) return 0;
    for (let i = row.length - 1; i >= 1; i--) {
      const v = parseNum(row[i]);
      if (v !== 0) return v;
    }
    return 0;
  };

  // ── Airfreight ──────────────────────────────────────────────────
  const [shipmentsRow] = findRowWithIdx("Total # of airfreight");
  const [weightRow, weightIdx] = findRowWithIdx("Total chargeable weight");
  const [profitRow, profitIdx] = findRowWithIdx("Total file profit (USD)");

  // ── Solution ────────────────────────────────────────────────────
  const [solutionShipmentsRow] = findRowWithIdx("Total # of solution");
  const [solutionWeightRow] = findRowWithIdx("Total chargeable weight", weightIdx + 1);
  const [solutionProfitRow, solutionProfitIdx] = findRowWithIdx("Total file profit (USD)", profitIdx + 1);

  // ── Ocean / Gulf Air (3rd profit occurrence) ────────────────────
  const [thirdProfitRow] = findRowWithIdx("Total file profit (USD)", solutionProfitIdx + 1);

  // Ocean freight shipments (AAINT)
  const [oceanShipmentsRow] = findRowWithIdx("Total # of ocean freight");
  // Gulf Air shipments (AAEA / Consolidated)
  const [gulfShipmentsRow] = findRowWithIdx("Gulf Air");

  // 3rd chargeable weight = ocean weight (INT) or gulf weight (EA)
  const [thirdWeightRow] = findRowWithIdx("Total chargeable weight", (solutionWeightRow ? rows.indexOf(solutionWeightRow) : weightIdx) + 1);

  // ── Staff ───────────────────────────────────────────────────────
  const [staffRow] = findRowWithIdx("Number of staff");

  // ── Total file profit (the non-USD summary row) ─────────────────
  const totalFileProfitRow = rows.find((r) => r[0]?.trim() === "Total file profit") ?? profitRow;

  const staffVal = staffRow ? parseNum(staffRow[staffRow.length - 1]) || parseNum(staffRow[1]) : 0;

  const airfreightShipmentsTotal = getTotalCol(shipmentsRow);
  const totalProfitVal = getTotalCol(totalFileProfitRow);

  return {
    months: MONTHS,
    shipments: extract(shipmentsRow),
    solutionShipments: extract(solutionShipmentsRow),
    solutionWeight: extract(solutionWeightRow),
    solutionProfit: extract(solutionProfitRow),
    oceanShipments: extract(oceanShipmentsRow),
    oceanWeight: oceanShipmentsRow ? extract(thirdWeightRow) : MONTHS.map(() => 0),
    oceanProfit: oceanShipmentsRow ? extract(thirdProfitRow) : MONTHS.map(() => 0),
    gulfShipments: extract(gulfShipmentsRow),
    gulfWeight: gulfShipmentsRow && !oceanShipmentsRow ? extract(thirdWeightRow) : MONTHS.map(() => 0),
    gulfProfit: gulfShipmentsRow && !oceanShipmentsRow ? extract(thirdProfitRow) : MONTHS.map(() => 0),
    weight: extract(weightRow),
    profit: extract(profitRow),
    totalProfit: extract(totalFileProfitRow),
    staff: staffVal,
    totals: {
      shipments: airfreightShipmentsTotal,
      weight: getTotalCol(weightRow),
      profit: getTotalCol(profitRow),
      totalProfit: totalProfitVal,
      // Solution
      solutionShipments: getTotalCol(solutionShipmentsRow),
      solutionWeight: getTotalCol(solutionWeightRow),
      solutionProfit: getTotalCol(solutionProfitRow),
      // Ocean (INT) — only present if ocean row found
      oceanShipments: getTotalCol(oceanShipmentsRow),
      oceanWeight: oceanShipmentsRow ? getTotalCol(thirdWeightRow) : 0,
      oceanProfit: oceanShipmentsRow ? getTotalCol(thirdProfitRow) : 0,
      // Gulf Air (EA) — only present if gulf row found
      gulfShipments: gulfShipmentsRow ? getTotalCol(gulfShipmentsRow) : 0,
      gulfWeight: gulfShipmentsRow && !oceanShipmentsRow ? getTotalCol(thirdWeightRow) : 0,
      gulfProfit: gulfShipmentsRow && !oceanShipmentsRow ? getTotalCol(thirdProfitRow) : 0,
      // Derived
      profitPerShipment: airfreightShipmentsTotal > 0 ? totalProfitVal / airfreightShipmentsTotal : 0,
    },
  };
}

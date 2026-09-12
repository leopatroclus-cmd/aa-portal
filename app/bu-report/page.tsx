import { BU_SHEETS, fetchBUData } from "@/lib/sheets";
import BUDashboard from "@/components/BUDashboard";

export const dynamic = "force-dynamic";

export default async function BUReportPage() {
  // Fetch all BU data in parallel
  const allData = await Promise.all(
    BU_SHEETS.map(async (bu) => ({
      ...bu,
      data: await fetchBUData(bu.name),
    }))
  );

  return <BUDashboard buSheets={allData} />;
}

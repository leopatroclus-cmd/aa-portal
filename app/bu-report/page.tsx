import { BU_SHEETS, fetchBURecords } from "@/lib/sheets";
import BUDashboard from "@/components/BUDashboard";

export const dynamic = "force-dynamic";

export default async function BUReportPage() {
  const allData = await Promise.all(
    BU_SHEETS.map(async (bu) => ({
      name: bu.name,
      label: bu.label,
      records: await fetchBURecords(bu),
    }))
  );

  return <BUDashboard buSheets={allData} />;
}

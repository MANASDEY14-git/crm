// src/scripts/update_sales.ts
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Supabase credentials are missing in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  // Adjust table and column names as needed
  const leadsTable = "sales_leads"; // TODO: verify actual table name
  const statusColumn = "status";
  const amountColumn = "amount";

  // Fetch completed leads
  const { data: completedLeads, error: fetchError } = await supabase
    .from(leadsTable)
    .select(`id, ${amountColumn}, ${statusColumn}`)
    .eq(statusColumn, "completed");

  if (fetchError) {
    console.error("Error fetching completed leads:", fetchError);
    process.exit(1);
  }

  if (!completedLeads?.length) {
    console.log("No completed leads found.");
    return;
  }

  const totalRevenue = completedLeads.reduce((sum: number, lead: any) => {
    const amt = Number(lead[amountColumn]);
    return sum + (isNaN(amt) ? 0 : amt);
  }, 0);

  // Update status to 'won' and set won_at timestamp
  const { error: updateError } = await supabase
    .from(leadsTable)
    .update({
      [statusColumn]: "won",
      won_at: new Date().toISOString(),
    })
    .in("id", completedLeads.map((l: any) => l.id));

  if (updateError) {
    console.error("Error updating leads to won:", updateError);
    process.exit(1);
  }

  console.log(`Total revenue from completed leads: $${totalRevenue.toFixed(2)}`);

  // Write report to file
  const report = {
    totalRevenue,
    processedLeads: completedLeads.length,
    timestamp: new Date().toISOString(),
  };
  const reportPath = path.resolve(__dirname, "../../sales_report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Report written to ${reportPath}`);
}

main().catch((e) => {
  console.error("Unexpected error:", e);
  process.exit(1);
});

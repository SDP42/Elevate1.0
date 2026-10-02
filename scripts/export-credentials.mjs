import { neon } from "@neondatabase/serverless";
import XLSX from "xlsx";
import fs from "node:fs";
import path from "node:path";

const sql = neon(process.env.DATABASE_URL);

async function exportCredentials() {
  const query = `
    select 
      a.role,
      t.team_code,
      a.display_name,
      a.username,
      coalesce(a.initial_password, '—') as password,
      t.seat_no,
      case when t.shortlisted then 'Yes (Round 2)' when t.id is not null then 'No (Round 1)' else '—' end as round_2_shortlist,
      string_agg(tm.name, ', ' order by tm.sort_order) as members
    from accounts a
    left join teams t on t.account_id = a.id
    left join team_members tm on tm.team_id = t.id
    group by a.id, a.role, t.team_code, a.display_name, a.username, a.initial_password, t.seat_no, t.shortlisted, t.id
    order by 
      case a.role
        when 'admin' then 1
        when 'core' then 2
        when 'regidesk' then 3
        when 'meal' then 4
        when 'team' then 5
        else 6
      end,
      t.id asc,
      a.username asc
  `;

  const accounts = await sql.query(query);

  const allRows = accounts.map((r) => ({
    Role: r.role.toUpperCase(),
    "Team Code": r.team_code || "—",
    "Display / Team Name": r.display_name,
    Username: r.username,
    Password: r.password,
    Seat: r.seat_no != null ? r.seat_no : "—",
    "Round 2 Shortlist": r.round_2_shortlist,
    "Team Members": r.members || "—",
  }));

  const teamRows = accounts
    .filter((r) => r.role === "team")
    .map((r) => ({
      "Team Code": r.team_code,
      "Team Name": r.display_name,
      Username: r.username,
      Password: r.password,
      Seat: r.seat_no != null ? r.seat_no : "—",
      "Round 2 Shortlist": r.round_2_shortlist,
      Members: r.members || "—",
    }));

  const staffRows = accounts
    .filter((r) => r.role !== "team")
    .map((r) => ({
      Role: r.role.toUpperCase(),
      Name: r.display_name,
      Username: r.username,
      Password: r.password,
    }));

  const wb = XLSX.utils.book_new();

  const wsAll = XLSX.utils.json_to_sheet(allRows);
  const wsTeams = XLSX.utils.json_to_sheet(teamRows);
  const wsStaff = XLSX.utils.json_to_sheet(staffRows);

  wsAll["!cols"] = [
    { wch: 12 },
    { wch: 12 },
    { wch: 22 },
    { wch: 18 },
    { wch: 16 },
    { wch: 8 },
    { wch: 20 },
    { wch: 45 },
  ];
  wsTeams["!cols"] = [
    { wch: 12 },
    { wch: 22 },
    { wch: 18 },
    { wch: 16 },
    { wch: 8 },
    { wch: 20 },
    { wch: 45 },
  ];
  wsStaff["!cols"] = [{ wch: 12 }, { wch: 22 }, { wch: 18 }, { wch: 16 }];

  XLSX.utils.book_append_sheet(wb, wsAll, "All Credentials");
  XLSX.utils.book_append_sheet(wb, wsTeams, "Teams");
  XLSX.utils.book_append_sheet(wb, wsStaff, "Staff & Judges");

  const filePath = path.resolve("elevate_credentials.xlsx");
  XLSX.writeFile(wb, filePath);
  console.log("Successfully created Excel sheet:", filePath);

  const csvPath = path.resolve("elevate_credentials.csv");
  const csvContent = XLSX.utils.sheet_to_csv(wsAll);
  fs.writeFileSync(csvPath, csvContent, "utf-8");
  console.log("Successfully created CSV file:", csvPath);
}

exportCredentials().catch((err) => {
  console.error("Export failed:", err);
  process.exit(1);
});

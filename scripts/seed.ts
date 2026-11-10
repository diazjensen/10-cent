// CLI seeder: `npm run seed` EMPTIES all tables in DATABASE_URL, then loads the demo data.
import { runSeed } from "../src/lib/seed/run";
import { pgdb } from "../src/lib/pg";

runSeed({ truncate: true })
  .then((summary) => {
    console.log(summary);
    console.log("Demo logins (phone; OTP is shown on screen in dev mode):");
    console.log("  Super admin  9000000001 | Moderator 9000000002 | Support 9000000003 | Sales 9000000004 | Content 9000000005");
    console.log("  Owner        9876543210 | Agent 9876543211 | Builder 9876543212 | Seeker 9876543213");
  })
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => pgdb.end());

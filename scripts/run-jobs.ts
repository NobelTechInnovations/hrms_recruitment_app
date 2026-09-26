// Runs the scheduled jobs once (interview reminders, 60-day milestones, invoices,
// subscription renewals, Find-Jobs-For-Me matching). Schedule with cron in production.
import { runScheduledJobs } from "../src/server/scheduled";

runScheduledJobs()
  .then((summary) => {
    console.log("✓ Scheduled jobs complete", summary);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

const { Client } = require('pg');
const fs = require('fs');

async function run() {
  const env = fs.readFileSync('.env.local', 'utf8');
  const dbUrl = env.match(/DATABASE_URL=["']?(.*?)["']?(\n|$)/)[1];
  
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  
  const sql = fs.readFileSync('supabase/migrations/20260708_gamification_v2.sql', 'utf8');
  try {
    await client.query(sql);
    console.log("Migration successful");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}
run();

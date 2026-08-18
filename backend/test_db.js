const { getDb } = require('./database');

async function run() {
  try {
    const db = await getDb();
    const tables = await db.all("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log("Connected Successfully! Tables in Supabase:", tables.map(t => t.table_name));
    
    // Check users
    const users = await db.all("SELECT * FROM users");
    console.log("Users in DB:", users.length);
  } catch (err) {
    console.error("DB Error:", err);
  } finally {
    process.exit(0);
  }
}

run();

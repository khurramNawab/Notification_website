const { getDb } = require('./database');

async function run() {
  try {
    const db = await getDb();
    console.log("DB instance acquired successfully!");
  } catch (err) {
    console.error("DB Error:", err);
  } finally {
    process.exit(0);
  }
}

run();

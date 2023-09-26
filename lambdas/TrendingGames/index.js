const AWS = require('aws-sdk');
const { Pool } = require('pg');

// connect to RDS(postgres)
// return client or undefined if error
const connectRDS = async () => {
  const pool = new Pool({
    host: "XXXX.eu-north-1.rds.amazonaws.com",
    port: 'XXXX',
    database: "XXXX",
    user: "XXXX",
    password: "XXXX",
  });
  try {
    const client = await pool.connect();
    return client;
  } catch (error) {
    console.error('Error connecting to RDS', error);
  }
  return undefined;
};

exports.handler = async (event) => {
  
  const client = await connectRDS();
  if (!client) return {statusCode: 500};
  
  const unixTimestamp = Math.floor(Date.now() / 1000);
  
  const res = await client.query("SELECT gameid FROM a_priority_table WHERE priority=1");
  const ids = res.rows.map(row => row.gameid);
  for (const id of ids) {
    const res1 = await client.query(`
      SELECT AVG(playercount) FROM gameid_${id}
      WHERE timestamp>${unixTimestamp-43200}
      AND playercount>0
      ;`);
    const res2 = await client.query(`
      SELECT AVG(playercount) FROM gameid_${id}
      WHERE timestamp BETWEEN ${unixTimestamp-129600}AND ${unixTimestamp-86400}
      AND playercount>0
      ;`);
    const avgPlayersLast12h = res1.rows[0].avg;
    const avgPlayersLast24to36h = res2.rows[0].avg;
    const dailyIncrease = (avgPlayersLast12h-avgPlayersLast24to36h) / avgPlayersLast24to36h;
    await client.query("INSERT INTO a_trending_daily VALUES ($1, $2)"+
      "ON CONFLICT (gameid) DO UPDATE SET increase = EXCLUDED.increase",
      [id, dailyIncrease]);
  }
  
  await client.release();
  return {statusCode: 200};
};

const AWS = require('aws-sdk');
const { Pool } = require('pg');

const maxPriority = 3;
const priorityTable = "a_priority_table";
const trendingTable = "a_trending_daily";
const gameIdTable = "gameid_" // + id. i.e. gameid_500

// connect to RDS(postgres)
// return client or undefined if error
const connectRDS = async () => {
  const pool = new Pool({
    host: process.env.hostUrl,
    port: process.env.port,
    database: process.env.databaseName,
    user: process.env.user,
    password: process.env.password,
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
  // get gameids
  const res = await client.query(`
  SELECT gameid
  FROM ${priorityTable}
  WHERE priority<=${maxPriority}`
  );
  // Get game playercount past 12h and past 24-36h. Calculate increase.
  const ids = res.rows.map(row => row.gameid);
  for (const id of ids) {
    const res1 = await client.query(`
      SELECT AVG(playercount)
      FROM ${gameIdTable+id}
      WHERE timestamp>${unixTimestamp-43200}
      AND playercount>0
      ;`);
    const res2 = await client.query(`
      SELECT AVG(playercount)
      FROM ${gameIdTable+id}
      WHERE timestamp BETWEEN ${unixTimestamp-129600} AND ${unixTimestamp-86400}
      AND playercount>0
      ;`);
    const avgPlayersLast12h = res1.rows[0].avg;
    const avgPlayersLast24to36h = res2.rows[0].avg;
    let dailyIncrease = (avgPlayersLast12h-avgPlayersLast24to36h) / avgPlayersLast24to36h;
    if (!Number.isFinite(dailyIncrease)) {
      dailyIncrease = 0;
    }
    // save increase (negative if decreased) to trending table
    await client.query(`
    INSERT INTO ${trendingTable}
    VALUES ($1, $2)
    ON CONFLICT (gameid)
    DO UPDATE SET increase = EXCLUDED.increase`,
    [id, dailyIncrease]);
  }
  
  await client.release();
  return {statusCode: 200};
};

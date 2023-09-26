const redis = require("redis");
const { Client } = require("pg");

// connect to redis and test connection.
// return client or undefined if error
const setupAndTestConn = async () => {
    const client = redis.createClient({
        url: "redis://XXXXXXXXXX",
    });
    try {
        await client.connect();
        if (await client.ping() == "PONG") {
            return client;
        }
    } catch (error) {
        console.log("Error connecting to redis:", error);
    }
    return undefined;
};

// connect to RDS(postgres)
// return client or undefined if error
const connectRDS = async () => {
  const client = new Client({
    host: "XXXXXXXXX.eu-north-1.rds.amazonaws.com",
    port: 'XXXX',
    database: "XXXXXX",
    user: "XXXXX",
    password: "XXXXXX",
  });
  try {
    await client.connect();
    return client;
  } catch (error) {
    console.error('Error connecting to RDS', error);
  }
  return undefined;
};

// close connections to redis and rds
const closeConnections = async (redisClient, rdsClient) => {
    await redisClient.quit();
    await rdsClient.end();
};

// ERROR HANDLING MISSING!!!!!!!!
// gets players information from currentplayers table
const getStatisticsFromRDS = async (rdsClient) => {
    const response = await rdsClient.query(`
        SELECT cp.gameid, cp.playercount, cp.peak, cp.bottom, COALESCE(pt.gamename, 'unknown') as gamename
        FROM currentplayers as cp
        LEFT JOIN a_priority_table as pt ON cp.gameid = pt.gameid
        ORDER BY cp.playercount DESC;
    `);
    const rows = response.rows;
    const items = [];
    for (let row of rows) {
        items.push({score: Number(row.playercount), value: JSON.stringify(row)});
    }
    return items;
};

// delete old players and save new
// TODO ERROR HANDLING
const saveToRedis = async (redisClient, items) => {
    await redisClient.del("players");
    await redisClient.ZADD("players", items);
};

const divideItemsToChunks = (items, chunkSize) => {
    const chunks = [];
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      chunks.push(chunk);
    }
    return chunks;
};

exports.handler = async (event) => {
  try {
    const redisClient = await setupAndTestConn();
    const rdsClient = await connectRDS();
    if (!redisClient) { throw new Error('redis connection error') }
    if (!rdsClient) { throw new Error('rds connection error') }
    
    const items = await getStatisticsFromRDS(rdsClient);
    await saveToRedis(redisClient, items);
    
    await closeConnections(redisClient, rdsClient);
    return {statusCode: 200};
  } catch (error) {
    return {statusCode: 500, error: error?.message}
  }
};

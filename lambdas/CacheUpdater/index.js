const redis = require("redis");
const { Client } = require("pg");

// connect to redis and test connection.
// return client or undefined if error
const setupAndTestConn = async () => {
    const client = redis.createClient({
        url: "redis://XXXX.eun1.cache.amazonaws.com:6379",
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
    host: "XXXX.eu-north-1.rds.amazonaws.com",
    port: 'XXXX',
    database: "XXXX",
    user: "XXXX",
    password: "XXXX",
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
    const items2 = [];
    for (let row of rows) {
      const stringifiedRow = JSON.stringify(row);
      items.push({score: Number(row.playercount), value: stringifiedRow});
      items2.push(row.gamename);
      items2.push(stringifiedRow);
    }
    return [items, items2];
};

const getDailyTrendingRDS = async (rdsClient) => {
    const response = await rdsClient.query(`
        SELECT td.gameid, td.increase, COALESCE(pt.gamename, 'unknown') as gamename
        FROM a_trending_daily as td
        LEFT JOIN a_priority_table as pt ON td.gameid = pt.gameid
        ORDER BY td.increase DESC
        LIMIT 10;
    `);
    const rows = response.rows;
    return rows;
    const items = [];
    for (let row of rows) {
        items.push({score: Number(row.playercount), value: JSON.stringify(row)});
    }
    return items;
};

const getAffDataRDS = async (rdsClient) => {
  const response = await rdsClient.query(`
    SELECT ad.gameid, ad.url, ad.price, ad.retailprice
    FROM affdata as ad
    LEFT JOIN a_trending_daily as td ON ad.gameid = td.gameid
    ORDER BY td.increase DESC
    LIMIT 10;
  `);
  const rows = response.rows;
  return rows;
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
    
    const [items, items2] = await getStatisticsFromRDS(rdsClient);
    await saveToRedis(redisClient, items);
    // saves every game also as key(gamename)-value(data) for search feature
    await redisClient.MSET(items2);
    
    
    // get TOP 10 daily trending from rds and save to redis
    const daily = await getDailyTrendingRDS(rdsClient);
    await redisClient.set('trendingDaily', JSON.stringify(daily));
    
    // get aff data for trending games from rds and save to redis.
    const affData = await getAffDataRDS(rdsClient);
    await redisClient.set('affData', JSON.stringify(affData));
    
    
    await closeConnections(redisClient, rdsClient);
    return {statusCode: 200};
  } catch (error) {
    return {statusCode: 500, error: error?.message}
  }
};

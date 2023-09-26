const axios = require('axios');
const { Pool } = require('pg');

const pool = new Pool({
  host: "XXXX.eu-north-1.rds.amazonaws.com",
  port: "XXXX",
  database: "XXXX",
  user: "XXXX",
  password: "XXXX",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
const url = "https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=";
exports.handler = async (event, context) => {
  const client = await pool.connect();
  
  const unixTimestamp = Math.floor(Date.now() / 1000);
  const priority_table = "a_priority_table";
  let rejectedSteamRequestsCounter = 0; 
  let invalidPlayerCountOrIdCounter = 0;
  
  try {
    const res = await client.query("SELECT gameid FROM "+priority_table+" WHERE priority=1");
    const ids = res?.rows.map(obj => obj?.gameid);
    if (ids?.length === 0) { throw new Error("no values found from "+priority_table); }
    
    //const prom2 =  client.query("CREATE TABLE IF NOT EXISTS "+tableName+" (timestamp INT NOT NULL, playercount INT NOT NULL, PRIMARY KEY (timestamp))");
    const results = await Promise.allSettled(ids.map(id => axios.get(url+id, {timeout: 15000}) ));
    
    const queryPromises = [];
    let updateQuery = "UPDATE currentplayers SET playercount = CASE gameid";
    results.map((result, index) => {
      const id = ids[index];
      if (result?.status === "fulfilled") {
        const currPlayers = result?.value?.data?.response?.player_count;
        if (!isNaN(currPlayers) && !isNaN(id)) {
          queryPromises.push(client.query("INSERT INTO gameid_"+id+" VALUES ($1, $2)", [unixTimestamp, currPlayers]));
          updateQuery += " WHEN "+id+" THEN "+currPlayers;
        } else {
          invalidPlayerCountOrIdCounter++;
        }
      } else {
        rejectedSteamRequestsCounter++;
      }
    });
    await Promise.allSettled(queryPromises);

    // update current to currentplayers table
    updateQuery += " ELSE playercount END";
    await client.query(updateQuery);
    
    // update 24h peak and bottom to currentplayers table
    const unix24hAgo = unixTimestamp - 86420;  // 20s "wiggle" room
    let update_peak_query = "UPDATE currentplayers SET peak = CASE gameid";
    let update_bottom_query = "UPDATE currentplayers SET bottom = CASE gameid";
    for (let id of ids) {
      const res = await client.query("SELECT MAX(playercount), MIN(playercount) FROM gameid_"+id+" WHERE timestamp>"+unix24hAgo);
      update_peak_query += " WHEN "+id+" THEN "+res?.rows[0]?.max;
      update_bottom_query += " WHEN "+id+" THEN "+res?.rows[0]?.min;
    }
    update_peak_query += " ELSE peak END";
    update_bottom_query += " ELSE bottom END";
    await client.query(`${update_peak_query}; ${update_bottom_query}`);
    
    client.release();
    return { statusCode: 200, body: {rejectedSteamRequestsCounter, invalidPlayerCountOrIdCounter} };
    
  } catch (error) {
    console.error('Error:', error);
    client.release();
    return { statusCode: 500, body: {rejectedSteamRequestsCounter, invalidPlayerCountOrIdCounter} };
  }
};

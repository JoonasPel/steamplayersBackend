const axios = require('axios');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.hostUrl,
  port: process.env.port,
  database: process.env.databaseName,
  user: process.env.user,
  password: process.env.password,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
const steamUrl =
"https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=";
const currentTable = "currentplayers";

exports.handler = async (event, context) => {
  const ids = JSON.parse(event.Records[0].body);
  const client = await pool.connect();
  const unixTimestamp = Math.floor(Date.now() / 1000);
  let rejectedSteamRequestsCounter = 0; 
  let invalidPlayerCountOrIdCounter = 0;
  
  try {
    // Add gameid table and currentplayers row for a game if doesnt exist yet.
    for (let id of ids) {
      if (!isNaN(id)){
        await client.query(`
        CREATE TABLE IF NOT EXISTS gameid_${id} 
        (timestamp INT NOT NULL, 
        playercount INT NOT NULL, 
        PRIMARY KEY (timestamp))
        `);
        await client.query(`
        INSERT INTO ${currentTable}
        VALUES (${id}, -1, -1, -1)
        ON CONFLICT (gameid)
        DO NOTHING
        `);
      }
    }
    // get game data from steam api
    const results = await Promise.allSettled(
      ids.map(id => axios.get(steamUrl+id, {timeout: 15000}) ));
    
    const queryPromises = [];
    let updateQuery = `UPDATE ${currentTable} SET playercount = CASE gameid`;
    results.map((result, index) => {
      const id = ids[index];
      if (result?.status === "fulfilled") {
        const currPlayers = result?.value?.data?.response?.player_count;
        if (!isNaN(currPlayers) && !isNaN(id)) {
          queryPromises.push(client.query(
            `INSERT INTO gameid_${id} VALUES ($1, $2)`, [unixTimestamp, currPlayers]));
          updateQuery += ` WHEN ${id} THEN ${currPlayers}`;
        } else {
          invalidPlayerCountOrIdCounter++;
        }
      } else {
        rejectedSteamRequestsCounter++;
      }
    });
    await Promise.allSettled(queryPromises);
    updateQuery += " ELSE playercount END";
    await client.query(updateQuery);
    
    // update 24h peak and bottom to currentplayers table
    const unix24hAgo = unixTimestamp - 86400;
    let update_peak_query = `UPDATE ${currentTable} SET peak = CASE gameid`;
    let update_bottom_query = `UPDATE ${currentTable} SET bottom = CASE gameid`;
    for (let id of ids) {
      const res = await client.query(`
        SELECT MAX(playercount), MIN(playercount)
        FROM gameid_${id}
        WHERE timestamp>${unix24hAgo} AND playercount>0
        `);
        
      update_peak_query += ` WHEN ${id} THEN ${res?.rows[0]?.max}`;
      update_bottom_query += ` WHEN ${id} THEN ${res?.rows[0]?.min}`;
    }
    update_peak_query += " ELSE peak END";
    update_bottom_query += " ELSE bottom END";
    await client.query(`${update_peak_query}; ${update_bottom_query}`);
    
    client.release();
    return {
      statusCode: 200,
      body: {
        rejectedSteamRequestsCounter,
        invalidPlayerCountOrIdCounter,
      }
    };
    
  } catch (error) {
    console.error('Error:', error);
    client.release();
    return {
      statusCode: 500,
      body: {
        rejectedSteamRequestsCounter,
        invalidPlayerCountOrIdCounter,
      }
    };
  }
};

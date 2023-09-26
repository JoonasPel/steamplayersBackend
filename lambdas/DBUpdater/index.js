const axios = require('axios');
const { Client } = require('pg');

// setup
const client = new Client({
  host: "XXXX.eu-north-1.rds.amazonaws.com",
  port: 'XXXX',
  database: "XXXX",
  user: "XXXX",
  password: "XXXX",
});
// connect outside handler to reuse con
client.connect()
  .then(() => { console.log('Connected to RDS'); })
  .catch((error) => { console.error('Error connecting to RDS:', error); });

exports.handler = async (event, context) => {
  const priority_table = "a_priority_table";
  try {
    const res = await client.query("SELECT gameid FROM "+priority_table+" WHERE priority=1");
    const ids = res?.rows.map(obj => obj?.gameid);
    if (ids?.length === 0) { throw new Error("no values found from "+priority_table); }
    
    const unixTimestamp = Math.floor(Date.now() / 1000);
    
    let updateQuery = "UPDATE currentplayers SET playercount = CASE gameid";
    for (let id of ids) {
      let tableName = "gameid_" + id;
      const prom1 = axios.get('https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid='+id, {timeout: 1000});
      //const prom2 =  client.query("CREATE TABLE IF NOT EXISTS "+tableName+" (timestamp INT NOT NULL, playercount INT NOT NULL, PRIMARY KEY (timestamp))");
      //const results = await Promise.allSettled([prom1, prom2]);
      const results = await Promise.allSettled([prom1]);
      const response = results[0]?.value;
   
      const currPlayers = response?.data?.response?.player_count;
      if (!isNaN(currPlayers)) {
        await client.query("INSERT INTO "+tableName+" VALUES ($1, $2)", [unixTimestamp, currPlayers]);
        updateQuery += " WHEN "+id+" THEN "+currPlayers; 
      }
    }
    
    // update current to currentplayers table
    updateQuery += " ELSE playercount END";
    await client.query(updateQuery);
    
    // update 24h peak and bottom to currentplayers table
    const unix24hAgo = unixTimestamp - 86420;  // 20s "wiggle" room
    let update_peak_query = "UPDATE currentplayers SET peak = CASE gameid"
    let update_bottom_query = "UPDATE currentplayers SET bottom = CASE gameid"
    for (let id of ids) {
      const res = await client.query("SELECT * FROM gameid_"+id+" WHERE timestamp>"+unix24hAgo+" ORDER BY playercount DESC LIMIT 300");
      const peak = res.rows[0].playercount;
      const bottom = res.rows[res.rowCount-1].playercount;
      update_peak_query += " WHEN "+id+" THEN "+peak;
      update_bottom_query += " WHEN "+id+" THEN "+bottom;
    }
    update_peak_query += " ELSE peak END";
    update_bottom_query += " ELSE bottom END";
    
    await client.query(`${update_peak_query}; ${update_bottom_query}`);

    return { statusCode: 200, body: 'Data retrieved and saved to RDS successfully' };
    
  } catch (error) {
    console.error('Error:', error);
    return { statusCode: 500, body: 'An error occurred' };
  }
};

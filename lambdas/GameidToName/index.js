const AWS = require('aws-sdk');
const { Client } = require('pg');
const axios = require('axios');

const steamUrl = "https://api.steampowered.com/ISteamApps/GetAppList/v2/"
const steamPlayerCountUrl = "https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=";

exports.handler = async (event, context) => {
  const client = new Client({
    host: "XXXX.eu-north-1.rds.amazonaws.com",
    port: 'XXXX',
    database: "XXXX",
    user: "XXXX",
    password: "XXXX",
  });
  try {
    await client.connect();
  } catch {
    console.error('Error connecting to RDS');
  }
  
  //const steamResponse = await axios.get(steamUrl);
  //const apps = steamResponse?.data?.applist?.apps;
  const res = await client.query("SELECT gameid FROM a_priority_table WHERE priority=-1 LIMIT 20000");
  const apps = res?.rows.map(app => app?.gameid);
  
  let i = 0;
  let urls = [];
  let gameids = [];
  for (let app of apps) {
    const appId = app;
    
    urls.push(steamPlayerCountUrl+appId);
    gameids.push(appId);
    i++;
    if (i<15) { continue; }
    const requestPromises = urls.map(url => axios.get(url, {timeout:1000}));
    const responses = await Promise.allSettled(requestPromises);
    
    const UpdateGamePriorityToDB = async (appid, playercount) => {
      const currPlayers = playercount;
      let priority = -1;
      if (currPlayers > 2000) {
        priority = 1;
      } else if (currPlayers > 250) {
        priority = 2;
      } else if (currPlayers > 25) {
        priority = 3;
      } else if (currPlayers >= 0) {
        priority = 4;
      }
  
    	client.query("UPDATE a_priority_table SET priority=($1) WHERE gameid=($2)", [priority, appid]);
    };
    
    let promises = [];
    responses.forEach((result, index) => { 
      if (result?.status === "fulfilled") {
        let prom = UpdateGamePriorityToDB(gameids[index], result?.value?.data?.response?.player_count);
        promises.push(prom);
      } else {
        let prom = UpdateGamePriorityToDB(gameids[index], 0);
        promises.push(prom);
      }
    });
    await Promise.allSettled(promises);
    
    i = 0;
    urls = [];
    gameids = [];
  }
  
  await client.end();
};

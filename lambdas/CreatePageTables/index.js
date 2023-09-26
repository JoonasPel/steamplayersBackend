const AWS = require('aws-sdk');
const { Client } = require('pg');


exports.handler = async (event, context) => {
  const HOWMANYGAMESPERPAGE = 10;
  
  // db setup
  const client = new Client({
    host: "XXXX.eu-north-1.rds.amazonaws.com",
    port: 'XXXX',
    database: "XXXX",
    user: "XXXX",
    password: "XXXX",
  });
  try {
    await client.connect();
  } catch (error) {
    console.error('Error connecting to RDS', error);
  }
  
  try {
    const res = await client.query(`
      SELECT cp.gameid, cp.playercount, cp.peak, cp.bottom, COALESCE(pt.gamename, 'unknown') as gamename
      FROM currentplayers as cp
      LEFT JOIN a_priority_table as pt ON cp.gameid = pt.gameid
      ORDER BY cp.playercount DESC;
    `);
    
    const gamesArray = res?.rows;
    if (gamesArray.length < 10) { throw new Error("error getting data from currentplayers to new pages")}
    
    // divide games into chunks that are own pages.
    const chunkSize = HOWMANYGAMESPERPAGE;
    const chunks = [];
    for (let i = 0; i < gamesArray.length; i += chunkSize) {
      const chunk = gamesArray.slice(i, i + chunkSize);
      chunks.push(chunk);
    }
    
    // create new tables for new pages. rename old ones, then rename new ones, then remove old ones.
    let pageNum = 0;
    for (let gamesInOnePage of chunks) {
      pageNum++;
      // map data into a working format and also deal with ' problem
      const values = gamesInOnePage.map(({ gameid, playercount, peak, bottom, gamename }) =>
      `(${gameid}, ${playercount}, ${peak}, ${bottom}, '${gamename.replace(/'/g, "''")}')`
      ).join(',');
      
      await client.query(`
        BEGIN;
        
        DROP TABLE IF EXISTS f_page_${pageNum}_new;
      
        CREATE TABLE f_page_${pageNum}_new (
          gameid INTEGER PRIMARY KEY,
          playercount INTEGER,
          peak INTEGER,
          bottom INTEGER,
          gamename text
        );
        
        INSERT INTO f_page_${pageNum}_new (gameid, playercount, peak, bottom, gamename)
        VALUES ${values};

        ALTER TABLE IF EXISTS f_page_${pageNum} RENAME TO f_page_${pageNum}_old;
      
        ALTER TABLE f_page_${pageNum}_new RENAME TO f_page_${pageNum};
        
        DROP TABLE IF EXISTS f_page_${pageNum}_old;
      
        COMMIT;
      `);
    }
    await client.end();
    return {statusCode: 200};
    
  } catch (error) {
    await client.end();
    console.error("error: ", error);
    return {statusCode: 500, error};
  }
};


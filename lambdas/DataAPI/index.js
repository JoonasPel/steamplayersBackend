const AWS = require('aws-sdk');
const { Client } = require('pg');


exports.handler = async (event, context) => {
  let pageNum = 1;
  if (event?.queryStringParameters) {
    pageNum = event.queryStringParameters?.page;
    if ( isNaN(pageNum) || pageNum < 1 ) {
      pageNum = 1;
    }
  }
  
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
  } catch {
    console.error('Error connecting to RDS');
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Hello. this is error !" }),
      headers: { 'Access-Control-Allow-Origin': '*', },
    };
  }
  
  try {
    const res = await client.query(`SELECT * FROM f_page_${pageNum} LIMIT 30`);
    await client.end();
    return {
      statusCode: 200,
      body: JSON.stringify({ data: res.rows}),
      headers: { 'Access-Control-Allow-Origin': "*", },
      //headers: { 'Access-Control-Allow-Origin': "https://www.steamplayers.info", },
    };
  } catch {
    await client.end();
    console.error('Error something');
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Hello. this is an error !" }),
      headers: { 'Access-Control-Allow-Origin': '*', },
    };
  }
};
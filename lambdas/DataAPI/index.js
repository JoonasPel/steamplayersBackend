const redis = require("redis");


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

const handlePageNumber = (event) => {
  let pageNum = 1;
  if (event?.queryStringParameters) {
    pageNum = event.queryStringParameters?.page;
    if ( isNaN(pageNum) || pageNum < 1 ) {
      pageNum = 1;
    }
  }
  return pageNum;
};

exports.handler = async (event, context) => {
  const HOWMANYGAMESPERPAGE = 10;
  
  const pageNum = handlePageNumber(event);
  
  const redisClient = await setupAndTestConn();
  if (!redisClient) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Hello. this is error !" }),
      headers: { 'Access-Control-Allow-Origin': '*', },
    };
  }
  
  try {
    const firstIndex = (pageNum-1)*HOWMANYGAMESPERPAGE;
    const lastIndex = firstIndex + HOWMANYGAMESPERPAGE -1;
    const res = await redisClient.ZRANGE("players", firstIndex, lastIndex, {"REV": true });
    await redisClient.quit();            
    return {
      statusCode: 200,
      body: { data: res},
      headers: { 'Access-Control-Allow-Origin': "*", },
      //headers: { 'Access-Control-Allow-Origin': "https://www.steamplayers.info", },
    };
  } catch {
    await redisClient.quit();
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Hello. this is an error !" }),
      headers: { 'Access-Control-Allow-Origin': '*', },
    };
  }
};
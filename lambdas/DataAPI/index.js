const redis = require("redis");


// connect to redis and test connection.
// return client or undefined if error
const setupAndTestConn = async () => {
    const client = redis.createClient({
        // using reader endpoint to increase performance
        url: "redis://XXXX.eun1.cache.amazonaws.com:6379",
    });
    try {
        await client.connect();
        return client;
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

// returns origin that client is using if allowed. null otherwise
const handleOrigin = (event) => {
  const allowedOrigins = ['http://localhost:3000', 'https://main.d2yddnto6p0zxx.amplifyapp.com'];
  const clientOrigin = event.headers.origin;
  let origin = null;
  if (allowedOrigins.includes(clientOrigin)) {
    origin = clientOrigin;
  }
  return origin;
};

exports.handler = async (event, context) => {
  const HOWMANYGAMESPERPAGE = 10;
  
  const origin = handleOrigin(event);
  const pageNum = handlePageNumber(event);
  
  const redisClient = await setupAndTestConn();
  if (!redisClient) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Hello. this is error !" }),
      headers: { 'Access-Control-Allow-Origin': origin, },
    };
  }
  
  try {
    const firstIndex = (pageNum-1)*HOWMANYGAMESPERPAGE;
    const lastIndex = firstIndex + HOWMANYGAMESPERPAGE -1;
    const res = await redisClient.ZRANGE("players", firstIndex, lastIndex, {"REV": true });
    await redisClient.quit();            
    return {
      statusCode: 200,
      body: JSON.stringify({data: res}),
      headers: { 'Access-Control-Allow-Origin': origin, },
    };
  } catch {
    await redisClient.quit();
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Hello. this is an error !" }),
      headers: { 'Access-Control-Allow-Origin': origin, },
    };
  }
};
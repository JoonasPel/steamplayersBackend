import axios from 'axios';
import validator from 'validator';
import redis from 'redis';

const maxItemsReturnedFromOpenSearch = 50;
const axiosTimeout = 10000;
const maxQueryLength = 30 // excess is just sliced off
const searchUrl = 'https://vpc-XXXX.'+
  'eu-north-1.es.amazonaws.com'+ '/games/_search';

const getGame = async (url, gamename) => {
  const response = await axios.get(url, {
    params: {
      q: gamename,
      size: maxItemsReturnedFromOpenSearch
    },
    timeout: axiosTimeout,
  });
  return response?.data?.hits?.hits;
};

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

const redisClient = await setupAndTestConn();
export const handler = async (event, context) => {
  try {
    if (!redisClient) {throw new Error("error connecting redis")}
    
    // handle user input/query
    const query = event?.queryStringParameters?.query ?? "";
    let sanitizedQuery = validator.escape(query);
    if (sanitizedQuery.length > maxQueryLength) {
      sanitizedQuery = sanitizedQuery.slice(0, maxQueryLength);
    }
    
    // get game names from openSearch and get data for those from elasticache
    const result = await getGame(searchUrl, sanitizedQuery);
    const gameNames = result.map(item => item?._source?.Game);
    let gameDataFalsysRemoved = [];
    if (gameNames.length > 0) {
      const gameData = await redisClient.MGET(gameNames);
      gameDataFalsysRemoved = gameData.filter(Boolean);
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify(gameDataFalsysRemoved),
      headers: { 'Access-Control-Allow-Origin': '*', },
    };
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', },
    };
  }
};
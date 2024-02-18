import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import pg from "pg";

const chunkSize = 300;
const maxPriority = 3;
const sqsClient = new SQSClient({});
const sqsQueueUrl = process.env.sqsQueueUrl;

const sendToSQS = async (message, id) => {
  const command = new SendMessageCommand({
  QueueUrl: sqsQueueUrl,
  MessageGroupId: id.toString(),
  MessageBody: JSON.stringify(message),
  });
  await sqsClient.send(command);
}

export const handler = async (event) => {
  // connect to database
  const pgClient = new pg.Client({
  host: process.env.hostUrl,
  port: process.env.port,
  database: process.env.databaseName,
  user: process.env.user,
  password: process.env.password,
  });
  await pgClient.connect();
  // get appids from database
  const res = await pgClient.query(`
  SELECT array_agg(gameid)
  FROM a_priority_table
  WHERE priority <= ${maxPriority}
  `);
  await pgClient.end();
  const appids = res.rows[0].array_agg;
  if (appids.length < 1) {
    throw new Error("Failed to get appids from database"); 
  }
  // divide appids to chunks and send to SQS
  for (let i = 0; i < appids.length; i += chunkSize) {
      const chunk = appids.slice(i, i + chunkSize);
      await sendToSQS(chunk, i);
  }
  
  return {
    statusCode: 200,
  };
};

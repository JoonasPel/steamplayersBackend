![alt text](https://github.com/JoonasPel/steamplayersBackend/blob/main/architecture.png?raw=true)

## Steamplayers Project Overview: Tracking Steam Games Player Data

This application leverages the Steam API to collect real-time player data for Steam games. The AWS hosted backend runs 24/7 automatically and fetches Steam API for the <strong>current</strong> players count in games (individually) every 30 minutes and with this information (combined with the earlier information saved in DB) calculates the daily peak and bottom for every game, and also daily trending games. Games can be searched with a search feature implemented with Opensearch.

## Key Features:

### Database:

Periodically collected data is stored in RDS(PostgreSQL as engine). The database includes game IDs+Names, playercount history with timestamps, current players, 24-hour peak and bottom playercounts and trending games with their player increase percentage.

### Cache:

After the most recent data has been collected and processed, it is updated to the redis cache (full cache invalidation), to allow clients to receive the needed data as fast as possible.
        
### Automated Backend Processing:

An EventBridge triggers a step function every 30 minutes, orchestrating a series of AWS Lambda functions. The Lambda functions sequentially collect current player count data for each game and then calculate peaks/bottoms and trending games. Finally the cache updating is triggered.
    
### Trending games:
Daily trending games are calculated with "sliding windows" where the app compares the average players the past 12 hours to the average players in the same 12h window yesterday. So for example, comparing the avg players [12:30,00.30] yesterday vs [12:30,00.30] today. And every 30 mins the windows move forward 30 mins, so the next time range is [13:00,01:00]. The idea is to make the trending games update every 30 minutes and not just once a day with some fixed time range. 

### React Frontend & API:
The React frontend features two tables. One showcasing current, peak, and bottom player counts for each game. Another displaying the top 10 trending games. React frontend fetches the data from backend through API Gateway which is connected to two different Lambdas, one handling "normal" data e.g. fetching top 20-30 games. And the other one handling a user written search query, which is "converted" into game IDs with Opensearch. For example: search query "apex" -> opensearch finds "Apex Legends" -> get player data of Apex Legends from redis -> return to the client. Caching of the data is also used in the frontend. Every response data is stored locally for 100 seconds, and if requested again during this, local cache is used instead. So for example going forward and backward in the player count table will not request the data again all the time.
    
### Affiliate links:
I made a script that searches the game from a game seller website and parses the html to find the price and url of that game. This url is then combined with my personal referral code (in the URL parameter) to create a "Buy Here!" link for every game that the game seller website sells. These links are shown next to the trending games but are disabled currently.

### Continuous Deployment:
Frontend is hosted in AWS Amplify. When a code change is pushed into GitHub "main" branch, Amplify notices it and builds/deploys the code. There is also a little pipeline"ish" aspect where the code can be pushed into "feature" branch which triggers the automatic Cypress e2e tests and SonarQube. After evaluating these are fine, the code could be merged to main for automatic deploying. This merging should be automated too, of course.

### Costs and scalability:
As shown in the architecture, there is a clear split between the backend, where the cost of "core" backend is always the same and independent of the users traffic. The "user-facing" backend cost scales by the user traffic and it could be very easily scaled to withstand a large amount of users by increasing the concurrency of Lambdas and if needed, the elasticache could have a primary node that is only used by the update process of core backend and the data fetching triggered by users would be executed on replica nodes with reader endpoint.

### Core-backend scalability solutions
The Steam API allows only one game per request, meaning that a big amount of requests needs to be sent. This scalability is implemented by using a single Lambda to read all game IDs from the database and then dividing them into chunks. These chunks are then pushed into SQS as individual items that consumer Lambdas can take and process concurrently. (one chunk of IDs per Lambda). 

### Future Enhancements:
  The backend currently does not check the Steam API for new game releases but the system is made so that it should be pretty straightforward to implement. The needed steps would be adding a new lambda function that fetches the game IDs and names from Steam API and updates the database with them and also adds the new game names to Opensearch so search queries can find them.

### Side note
I didn't have/update this repository while making the project but instead just\
pushed everything here at once. I created an "artificial" commit history to\
show the version history of lambdas, so code changes can be seen.

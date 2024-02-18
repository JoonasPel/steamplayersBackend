![alt text](https://github.com/JoonasPel/steamplayersBackend/blob/main/architecture.png?raw=true)

## Steamplayers Project Overview: Tracking Steam Games Player Data

This application leverages the Steam API to collect real-time player data for Steam games, providing valuable insights into gaming trends. The AWS hosted backend runs 24/7 automatically and fetches Steam API for the <strong>current</strong> players count in games (individually) every 30 minutes and with this information (combined with the earlier information saved in DB) calculates 24h peak, bottom and also trending games today. Games can be search with a search feature implemented with Opensearch.
There is also affiliate links for trending games made with data scraping.

Key Features:

    Data Collection and Storage:
      Utilizing the Steam API, the application periodically gathers player count
      data for each game and stores it in RDS that uses PostgreSQL engine. Using
      the collected data, 24 hours peak and bottom player count for each game can
      be calculated and also trending games.
      The database includes game IDs+Names, player count history with timestamps,
      current players, 24-hour peak and bottom player counts and trending
      games with their player increase. And also the affiliate links for games.

    Automated Backend Processing:
      An EventBridge triggers a step function every 30 minutes, orchestrating
      a series of AWS Lambda functions.
      The Lambda functions sequentially collect current player count data
      for each game and then calculate peaks/bottoms and trending games,
      saving the results to Postgres. The relevant information (current,
      peak, bottom, trending) is also actively loaded into in-memory cache,
      to allow fast fetching. For this Elasticache with redis is used.
      Old data is cleared from redis and new is inserted in every update (30 mins).
    
    Trending games:
      Daily trending games are calculated with "sliding windows" where the app
      compares the average players the past 12 hours to the average players
      in the same 12h window yesterday. So for example, compare the avg
      players [12:30,00.30] yesterday vs [12:30,00.30] today. And every 30 mins
      the windows move forward 30 mins, so the next time range is [13:00,01:00].
      The point of this is that the trending games are updated EVERY 30 minutes
      and not just once a day with some fixed time range. 

    React Frontend:
      The React frontend features two tables:
        One showcasing current, peak, and bottom player counts for each game.
        Another displaying the top 10 trending games and their day-to-day
        player count increases. The affiliate links are not enabled currently.
      React frontend fetches the data from backend through API Gateway which
      is connected to two different Lambdas, one handling "normal" data e.g.
      top 20-30 games. And the other one handling a user written search query
      which is "converted" into game IDs with Opensearch.
      For example: search query "apex" -> opensearch finds "Apex Legends"
      -> get player data of Apex Legends from redis -> return to the client.
      Caching of the data is also used in the frontend. Every response data
      is stored locally for 100 seconds, and if requested again during this,
      cache is used instead. So for example going forward and backward in
      the player count table will not request the data again all the time.
    
    Affiliate links:
      I made a program that searches the game from a game seller website and
      parses the html to find the price and url of that game. This url is then
      combined with my personal referral code (in the URL parameter) to create
      a "Buy Here!" link for every game that the game seller website sells.

    Continuous Deployment:
      Frontend is hosted in AWS Amplify. When a code change is pushed into
      "main" branch, Amplify notices it and builds/deploys the code.
      I have used but not yet added in this project a simple testing step
      to this pipeline where the code change is actually pushed into "feature"
      branch, which triggers Github Action that runs Cypress e2e tests and if
      passed, pushes the code to "main" branch. Which is then deployed by
      Amplify.

    Costs and scalability:
      As shown in the architecture, there is a clear split between the backend,
      where the cost of "core" backend is always the same and independent of
      the users traffic but "user-facing" scales by user traffic.
      The "user-facing" backend cost scales by the user traffic and it could
      be very easily be scaled to withstand a large amount of users because the
      lambdas can have high concurrency and Elasticache and Elastisearch node
      amount could be increased. If needed, the elasticache could have a primary
      node that is only used by the update process of core backend and the data
      fetching triggered by users would be executed on replica nodes with reader
      endpoint.

    Future Enhancements:
      The backend currently does not check the Steam API for new game releases
      but the system is made so that it should be pretty straightforward to
      implement and add. The needed steps would be adding a new lambda function
      that fetches the game ids and names from Steam API and updates the Postgres
      DB with them and also adds the new game names to Opensearch so search queries
      can find them. The lambda could be then triggered by the step-function or even
      by an individual Eventbridge.
      
This Project Overview is still in progress but provides the most important information.

I didn't have/update this repository while making the project but instead just\
pushed everything here at once. I created an "artificial" commit history to\
show the version history of lambdas, so code changes can be seen.
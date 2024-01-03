This repository is a backup of lambda functions used in my steamplayers\
project, hosted in AWS. I didn't update this while making the project but instead just\
pushed everything here at once. I created an "artificial" commit history to\
show the version history of functions, so code changes can be seen.

![alt text](https://github.com/JoonasPel/steamplayersBackend/blob/main/architecture.png?raw=true)

## Steamplayers Project Overview: Tracking Steam Games Player Data

This application leverages the Steam API to collect real-time player data for Steam games, providing valuable insights into gaming trends. The AWS hosted backend runs 24/7 automatically and fetches Steam API for the <strong>current</strong> players count in games (individually) every 30 minutes and with this information (combined with the earlier information saved in DB) calculates 24h peak, bottom and also trending games today. Games can be search with a search feature implemented with Opensearch.
There is also affiliate links for trending games made with data scraping.

Key Features:

    Data Collection and Storage:
      Utilizing the Steam API, the application gathers player count data for
      each game and stores it in a PostgreSQL database.
      The database architecture includes game IDs, player count history with
      timestamps, current players, 24-hour peak and bottom player counts and
      trending games with their player increase.

    Automated Backend Processing:
      An EventBridge triggers a step function every 30 minutes, orchestrating
      a series of AWS Lambda functions.
      The Lambda functions sequentially collect player current count data,
      calculate trending games based on a 12-hour sliding window, and save
      the results to Postgres and also the relevant information with active
      approach to Redis for fast fetching.
    
    Trending games:
      Trending games today are calculated with "sliding windows" where the app
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
    
    Affiliate links:
      I made a program that searches the game from a game seller website and
      parses the html to find the price and url of that game. This url is then
      combined with my personal referral code (in the URL parameter) to create
      a "Buy Here!" link for every game that the game seller website sells.

    Continuous Deployment:
      Frontend is hosted in AWS Amplify. There is a simple CI/CD system,
      where the code change is pushed to a feature branch and then Github
      action runs e2e tests with Cypress and if passed, pushes the code change
      to main branch which Amplify monitors. When Amplify sees the change in
      main branch it, builds and deploys the code.

    Future Enhancements:
      The backend currently does not check the Steam API for new game releases
      but the system is made so that it should be pretty straightforward to
      implement and add.

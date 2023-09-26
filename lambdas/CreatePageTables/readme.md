RETIRED. elasticache used instead of this.\

Before Elasticache, this created the page data so that frontend request could\
read it straight from postgres without need for any ordering etc.\
For example, if page 7 data was needed => SELECT * FROM page_7.\
When data was updated, the code updates the page_x tables with a name "hot-swap"\
in a transaction.

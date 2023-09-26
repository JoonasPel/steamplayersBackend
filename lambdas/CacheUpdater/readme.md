AWS Lambda Versions:\
	4	currentplayers(sorted set) + trendingDaily + affData + currentplayers(key-value)\
	3	currentplayers + trendingDaily + affData\
	2	currentplayers + trendingDaily\
	1	from rds get currentplayers(+names from a_priority_table) and save to elastiCache\
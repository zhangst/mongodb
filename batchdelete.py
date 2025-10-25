from pymongo import MongoClient
from datetime import datetime, timedelta, timezone
import time


client = MongoClient('mongodb+srv://root1:1234@x.kisec.mongodb.net/')
db = client['sample']
collection = db['minimax_ttl1']



start_time = datetime(2025, 5, 15, 11, 42, 00, tzinfo=timezone.utc)
end_time = datetime(2025, 5, 15, 12, 42, 00, tzinfo=timezone.utc)

# 步长
step = timedelta(seconds=1)

current_time = start_time
total_deleted = 0

print(f"开始按时间批量删除文档，时间范围: {start_time} 到 {end_time}")

while current_time <= end_time:

    delete_result = collection.delete_many({"expired_at_date": {"$lt": current_time}})
    

    deleted_count = delete_result.deleted_count
    total_deleted += deleted_count

    local_time = time.localtime()
    formatted = time.strftime("%Y-%m-%d %H:%M:%S", local_time)
    print(f"{formatted} 删除 {current_time} 之前的文档: {deleted_count} 条")
    

    current_time += step

    
    time.sleep(0.7)

print(f"删除操作完成，共删除 {total_deleted} 条文档")


client.close()

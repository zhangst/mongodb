from pymongo import MongoClient
from datetime import datetime, timedelta, timezone
import time
from bson.objectid import ObjectId

# 连接到 MongoDB
client = MongoClient('mongodb+srv://root1:1234@minimax6.kisec.mongodb.net/')
db = client['sample']  # 替换为你的数据库名
collection = db['minimax_ttl1']  # 替换为你的集合名

start_time = datetime(2025, 5, 14, 23, 47, 20, tzinfo=timezone.utc)
end_time = datetime(2025, 5, 15, 00, 52, 40, tzinfo=timezone.utc)



step = timedelta(seconds=1)

# 时间戳转换为 ObjectId 的函数
def timestamp_to_objectid(timestamp):
    timestamp_seconds = int(timestamp.timestamp())
    hex_timestamp = format(timestamp_seconds, 'x').zfill(8)
    return ObjectId(f"{hex_timestamp}0000000000000000")


current_time = start_time
total_deleted = 0


print(f"开始按 ObjectId 批量删除文档，时间范围: {start_time} 到 {end_time}")

while current_time <= end_time:
    # 计算当前时间和下一个时间点对应的 ObjectId
    # current_objectid = timestamp_to_objectid(current_time)
    next_time = current_time + step
    next_objectid = timestamp_to_objectid(next_time)
    
    # 构建基于 ObjectId 范围的查询
    delete_query = {
        "_id": {
            # "$gte": current_objectid,
            "$lte": next_objectid
        }
    }
    
    # 删除指定 ObjectId 范围内的文档
    delete_result = collection.delete_many(delete_query)
    
    # 打印删除结果
    deleted_count = delete_result.deleted_count
    total_deleted += deleted_count
    print(f"删除 ObjectId 范围 小于 {next_time}({next_objectid}) 的文档: {deleted_count} 条")
    
    # 增加时间步长
    current_time = next_time
    
    # 可选：添加延迟，避免对数据库造成过大压力
    # time.sleep(0.1)

print(f"删除操作完成，共删除 {total_deleted} 条文档")

# 关闭连接
client.close()

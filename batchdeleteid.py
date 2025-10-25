from pymongo import MongoClient
from datetime import datetime, timedelta
import time
from bson.son import SON

# 连接到 MongoDB
client = MongoClient('mongodb+srv://root1:1234@minimax.kisec.mongodb.net/')
db = client['sample']  # 替换为你的数据库名
collection = db['minimax_ttl1']  # 替换为你的集合名

# 设置起始时间和结束时间
start_time = datetime(2025, 4, 25, 8, 50, 20)  # 根据你的数据调整起始时间
end_time = datetime(2025, 4, 25, 9, 50, 20)    # 根据你的数据调整结束时间

# 设置每次删除的时间步长
step = timedelta(seconds=1)

current_time = start_time
total_deleted = 0

print(f"开始按 _id 字段中的时间批量删除文档，时间范围: {start_time} 到 {end_time}")

while current_time <= end_time:
    # 构建基于 _id 字段的时间查询
    delete_query = {
        "$expr": {
            "$lt": [
                {"$toDate": "$_id"}, 
                current_time
            ]
        }
    }
    
    # 删除当前时间点之前的所有文档
    delete_result = collection.delete_many(delete_query)
    
    # 打印删除结果
    deleted_count = delete_result.deleted_count
    total_deleted += deleted_count
    print(f"删除 _id 时间早于 {current_time} 的文档: {deleted_count} 条")
    
    # 增加时间步长
    current_time += step
    
    # 可选：添加延迟，避免对数据库造成过大压力
    time.sleep(0.1)

print(f"删除操作完成，共删除 {total_deleted} 条文档")

# 关闭连接
client.close()

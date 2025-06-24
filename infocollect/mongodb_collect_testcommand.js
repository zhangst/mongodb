
use limitation_test_db;


// 1. 【触发】Views Present
db.source_for_view.insertOne({ message: "this is the source collection" });
db.createView(
   "my_view",
   "source_for_view",
   [ { $project: { _id: 0 } } ]
);
print("✅ 1. [View] 'my_view' created.");




// 2. 【触发】Timeseries Collections
db.createCollection(
    "timeseries_coll",
    {
        timeseries: {
            timeField: "timestamp",
            metaField: "metadata",
            granularity: "hours"
        }
    }
);
db.timeseries_coll.insertOne({
    "metadata": { "sensorId": 5578, "type": "temperature" },
    "timestamp": new Date(),
    "temp": 28
});
print("✅ 2. [Timeseries] 'timeseries_coll' created.");


// 3. 【触发】Duplicate Key Indexes (唯一 vs 非唯一)
db.duplicate_index_coll.insertOne({ email: "test@example.com" });
db.duplicate_index_coll.createIndex({ email: 1 }, { unique: true });
db.duplicate_index_coll.createIndex({ email: 1 }, { unique: false, name: "duplicate_non_unique" });
print("✅ 3. [Duplicate Key Index] Indexes on 'duplicate_index_coll' created.");


// 4. 【触发】Empty Sort Field in Index
// db.empty_sort_coll.insertOne({ my_sort_field: "abc" });
// db.empty_sort_coll.createIndex({ my_sort_field: "" });
// print("✅ 4. [Empty Sort Index] Index on 'empty_sort_coll' created.");



// 在这个库里创建一个带点的集合
db.getCollection("collection.with.dots").insertOne({ test: 1 });
print("✅ 5. [Dotted Names] Database 'db.with.dots' and a dotted collection created.");




// 6. 【触发】Is Sharded & Sharding Zones Configured
//    a. 创建一个集合并为其分片
sh.enableSharding("limitation_test_db");
print("Database 'limitation_test_db' sharding enabled.");
db.sharded_coll_with_zones.insertOne({ shardKey: 50, data: "some data" });
db.sharded_coll_with_zones.createIndex({ shardKey: 1 });
sh.shardCollection("limitation_test_db.sharded_coll_with_zones", { shardKey: 1 });
print("✅ 6a. [Sharded Collection] 'sharded_coll_with_zones' is now sharded.");
//    b. 配置 Sharding Zone(修改 shard 名称 和 zone tag)
sh.addShardTag("shard0000", "ZONE_A");
sh.addShardTag("shard0001", "ZONE_B");
sh.addTagRange(
    "limitation_test_db.sharded_coll_with_zones",
    { shardKey: MinKey },
    { shardKey: 100 },
    "ZONE_A"
);
print("✅ 6b. [Sharding Zones] Zones have been configured.");







db.createCollection(
    "clustered_ttl_coll",
    {
        clusteredIndex: { key: { _id: 1 }, unique: true }
    }
);
db.clustered_ttl_coll.insertOne({ _id: new ObjectId(), createdAt: new Date(), message: "This is a clustered collection" });
db.clustered_ttl_coll.createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 });
print("✅ 7. [Clustered with TTL] 'clustered_ttl_coll' created.");




db.createCollection(
    "mock_qe_coll", 
    { 
        encryptedFields: { 
            "fields": [ 
                { "path": "taxID", "bsonType": "string", "keyId": new UUID(), "queries": { "queryType": "equality" } } 
            ] 
        } 
    }
);
db.mock_qe_coll.insertOne({ taxID: "should be encrypted" });
print("✅ 8. [Queryable Encryption] 'mock_qe_coll' with simulated QE options created.");


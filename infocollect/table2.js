print('DB Name, Collection Name, Data Size(MB), Index Size(MB), Sharded, TimeSeries, View, Validator');

db.getSiblingDB("config").databases.find({ _id: { $nin: ["admin", "local", "config"] } }).forEach(dbInfo => {
  const dbName = dbInfo._id;
  const database = db.getSiblingDB(dbName);

  database.getCollectionInfos().forEach(coll => {
    const collName = coll.name;
    const fullName = `${dbName}.${collName}`;

    if (collName.startsWith('system.')) return;


    const isShardedEntry = db.getSiblingDB('config').collections.findOne({ _id: fullName });
    const isSharded = isShardedEntry ? "Yes" : "No";
    const isTimeSeries = coll.options.timeseries ? "Yes" : "No";
    const isView = coll.type === "view" ? "Yes" : "No";
    const hasValidation = coll.options.validator ? "Yes" : "No";



    let sizeMB = 0, indexSizeMB = 0;
    if (coll.type === "collection") {
      const stats = database[collName].stats({ scale: 1024 * 1024 });
      sizeMB = stats.size;
      indexSizeMB = stats.totalIndexSize;
    }

    print(`${dbName},${collName},${sizeMB},${indexSizeMB},${isSharded},${isTimeSeries},${isView},${hasValidation}`);
  });
});

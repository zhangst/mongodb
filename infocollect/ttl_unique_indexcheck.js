// 检查当前集群中有没有 TTL 或 Unique 索引，做迁移前的检查



const databases = db.adminCommand({ listDatabases: 1 }).databases;
const ttlCollections = [];
const uniqueCollections = [];


databases.forEach(function(database) {
  const dbName = database.name;

  if (dbName !== 'admin' && dbName !== 'config' && dbName !== 'local') {

    const currentDb = db.getSiblingDB(dbName);
    const collections = currentDb.getCollectionNames();


    collections.forEach(function(collectionName) {

      const indexes = currentDb.getCollection(collectionName).getIndexes();

      const ttlIndex = indexes.find(index => index.expireAfterSeconds !== undefined);
      const uniqueIndexes = indexes.filter(index => index.unique);

      if (ttlIndex) {
        ttlCollections.push(`${currentDb.getName()}.${collectionName}`);
      }
      if (uniqueIndexes.length > 0) {
        uniqueCollections.push(`${currentDb.getName()}.${collectionName}`);
      }
    });
  }
});


if (ttlCollections.length > 0) {
  print('TTL:');
  ttlCollections.forEach(function(collection) {
    print(collection);
  });
}
if (uniqueCollections.length > 0) {
  print('Unique:');
  uniqueCollections.forEach(function(collection) {
    print(collection);
  });
}

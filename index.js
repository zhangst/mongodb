const adminDb = db.getSiblingDB('admin');

print("Database,Collection,Index Name,Index Fields,Index Size (bytes),Accesses,Full Index Details");

adminDb.adminCommand('listDatabases').databases.forEach(database => {
  const dbName = database.name;
  
  if (dbName !== 'admin' && dbName !== 'local' && dbName !== 'config') {
    const currentDb = db.getSiblingDB(dbName);
    
    currentDb.getCollectionInfos({ type: "collection" }).forEach(collectionInfo => {
      const collectionName = collectionInfo.name;
      if (collectionName.startsWith('system.buckets')) {
          return;
      }
      const collection = currentDb.getCollection(collectionName);
      
      const indexes = collection.getIndexes();
      
      indexes.forEach(index => {
        const indexSizes = currentDb.runCommand({ collStats: collectionName }).indexSizes || {};
        const usage = currentDb.runCommand({ aggregate: collectionName, pipeline: [
          { $indexStats: {} },
          { $match: { name: index.name } }
        ], cursor: {} }).cursor.firstBatch[0] || {};
        
        const indexFields = JSON.stringify(index.key).replace(/"/g, '""');

        const fullIndexDetails = JSON.stringify(index).replace(/"/g, '""');

        print(`"${dbName}","${collectionName}","${index.name}","${indexFields}",${indexSizes[index.name] || 0},${usage.accesses ? usage.accesses.ops : 0},"${fullIndexDetails}"`);
      });
    });
  }
});


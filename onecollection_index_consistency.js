// --- Configuration: Modify these values ---
const dbName = "xinfei";
const collectionName = "xinfei2";
// --- End Configuration ---


(() => {
    print(`Starting index consistency check for: ${dbName}.${collectionName}`);
    
    let indexStats;
    try {
        indexStats = db.getSiblingDB(dbName)[collectionName].aggregate([{$indexStats:{}}]).toArray();
    } catch (e) {
        print(`Error: Failed to execute $indexStats. Ensure you are connected to a mongos.\nDetails: ${e}`);
        return;
    }

    if (!indexStats || indexStats.length === 0) {
        print("Error: No index information found. Please verify the collection exists.");
        return;
    }

    const indexesByShard = {};
    const masterIndexSet = new Set();

    indexStats.forEach(stat => {
        masterIndexSet.add(stat.name);
        if (!indexesByShard[stat.shard]) {
            indexesByShard[stat.shard] = new Set();
        }
        indexesByShard[stat.shard].add(stat.name);
    });

    const masterIndexList = Array.from(masterIndexSet);
    const shardNames = Object.keys(indexesByShard);

    print(`- Detected Shards (${shardNames.length}): ${shardNames.join(', ')}`);
    print(`- Master Index List (${masterIndexList.length}): ${masterIndexList.join(', ')}`);
    print("---");

    let inconsistenciesFound = false;

    for (const shardName of shardNames) {
        const shardIndexes = indexesByShard[shardName];
        for (const expectedIndex of masterIndexList) {
            if (!shardIndexes.has(expectedIndex)) {
                print(`[INCONSISTENCY] Shard '${shardName}' is missing index: '${expectedIndex}'`);
                inconsistenciesFound = true;
            }
        }
    }

    print("---");
    if (inconsistenciesFound) {
        print("Check Complete: Inconsistencies were found.");
    } else {
        print("Check Complete: All indexes are consistent across all shards.");
    }
})();

(() => {
    const SYSTEM_DBS = ['admin', 'config', 'local'];

    function checkCollection(dbName, collectionName) {
        let indexStats;
        try {
            indexStats = db.getSiblingDB(dbName).getCollection(collectionName).aggregate([{$indexStats:{}}]).toArray();
        } catch (e) {
            return { status: 'ERROR', message: `Failed to run $indexStats: ${e.message}` };
        }

        if (!indexStats || indexStats.length === 0) {
            return { status: 'SKIPPED', message: 'Collection has no indexes or is a view.' };
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

        const shardNames = Object.keys(indexesByShard);
        if (shardNames.length <= 1) {
            return { status: 'SKIPPED', message: 'Collection is unsharded or exists on only one shard.' };
        }
        
        const issues = [];
        const masterIndexList = Array.from(masterIndexSet);

        for (const shardName of shardNames) {
            const shardIndexes = indexesByShard[shardName];
            for (const expectedIndex of masterIndexList) {
                if (!shardIndexes.has(expectedIndex)) {
                    issues.push(`Shard '${shardName}' is missing index: '${expectedIndex}'`);
                }
            }
        }

        if (issues.length > 0) {
            return { status: 'INCONSISTENT', issues: issues };
        } else {
            return { status: 'CONSISTENT' };
        }
    }

    // --- Main Execution ---
    print("=====================================================");
    print("Starting Full Cluster Index Consistency Scan...");
    print(`Excluding system databases: ${SYSTEM_DBS.join(', ')}`);
    print("=====================================================\n");

    let collectionsChecked = 0;
    let inconsistenciesFound = 0;

    const allDbs = db.adminCommand({ listDatabases: 1 }).databases;

    for (const dbInfo of allDbs) {
        const dbName = dbInfo.name;
        if (SYSTEM_DBS.includes(dbName)) {
            continue;
        }

        print(`Scanning Database: ${dbName}`);
        print("-----------------------------------");

        const collections = db.getSiblingDB(dbName).getCollectionNames();
        if (collections.length === 0) {
            print("  No collections found.\n");
            continue;
        }

        for (const collectionName of collections) {
            collectionsChecked++;
            const fullName = `${dbName}.${collectionName}`;
            
            const result = checkCollection(dbName, collectionName);

            switch (result.status) {
                case 'CONSISTENT':
                    print(`- ${fullName} ... OK`);
                    break;
                case 'INCONSISTENT':
                    inconsistenciesFound++;
                    print(`- ${fullName} ... !!! INCONSISTENT !!!`);
                    result.issues.forEach(issue => {
                        print(`    -> ${issue}`);
                    });
                    break;
                case 'SKIPPED':
                    // Optional: uncomment the line below to see skipped collections.
                    // print(`- ${fullName} ... SKIPPED (${result.message})`);
                    break;
                case 'ERROR':
                    print(`- ${fullName} ... ERROR (${result.message})`);
                    break;
            }
        }
        print("");
    }

    print("=====================================================");
    print("Scan Complete.");
    print(`Total collections analyzed: ${collectionsChecked}`);
    if (inconsistenciesFound > 0) {
        print(`!!! Found inconsistencies in ${inconsistenciesFound} collection(s).`);
    } else {
        print("All sharded collections have consistent indexes.");
    }
    print("=====================================================");

})();

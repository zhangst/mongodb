(function() {
    'use strict';

    const output = [];
    const adminDb = db.getSiblingDB('admin');
    
    // --- Section 0: Cluster-wide Info ---
    try {
        const serverStatus = adminDb.runCommand({ serverStatus: 1 });
        const cmdLine = adminDb.runCommand({ getCmdLineOpts: 1 });
        
        let storageEngineName = 'unknown';

        // ***** FIX: New dual-check logic for Storage Engine *****
        // Primary Method: Check serverStatus directly (works best for replica sets)
        if (serverStatus.storageEngine && serverStatus.storageEngine.name) {
            storageEngineName = serverStatus.storageEngine.name;
        } 
        // Fallback Method: Check collection stats (more reliable on mongos)
        else {
            try {
                const configDb = db.getSiblingDB('config');
                // Check stats on a reliable collection in the config db.
                const stats = configDb.collections.stats(); 
                if (stats && stats.hasOwnProperty('wiredTiger')) {
                    storageEngineName = 'wiredTiger';
                }
            } catch (e) {
                // If fallback also fails, log it but continue
                console.error(`// Could not determine storage engine via fallback: ${e}`);
            }
        }

        let hasZones = false;
        let isBalancerRunning = false; 

        if (serverStatus.process === 'mongos') {
            const configDb = db.getSiblingDB('config');
            if (configDb.tags.countDocuments({}) > 0) {
                hasZones = true;
            }
            isBalancerRunning = sh.getBalancerState();
        }

        output.push({
            section: "cluster_info",
            output: {
                version: serverStatus.version,
                storageEngine: storageEngineName,
                hasZones: hasZones,
                isBalancerRunning: isBalancerRunning,
                cmdLine: cmdLine.parsed,
                modules: JSON.stringify(serverStatus.modules)
            }
        });
    } catch (e) {
        console.error(`// Could not fetch cluster info: ${e}`);
    }

    const databases = adminDb.runCommand({ listDatabases: 1 }).databases;
    const excludeDbs = ["admin", "local", "config"];

    databases.forEach(dbInfo => {
        const dbName = dbInfo.name;
        if (excludeDbs.includes(dbName)) return;

        const currentDb = db.getSiblingDB(dbName);
        const collectionInfos = currentDb.runCommand({ listCollections: 1 }).cursor.firstBatch;

        collectionInfos.forEach(collInfo => {
            const collName = collInfo.name;
            if (collName.startsWith('system.')) return;

            let stats = {};
            try { stats = currentDb.getCollection(collName).stats({ scale: 1 }); } catch (e) {}
            
            const isClustered = !!(collInfo.options && collInfo.options.clusteredIndex);
            let isClusteredWithTTL = false;
            let hasAtlasSearchIndex = false;

            if (collInfo.type === 'collection') {
                const allIndexes = currentDb.getCollection(collName).getIndexes();
                
                if (isClustered && allIndexes.some(idx => idx.hasOwnProperty('expireAfterSeconds'))) {
                    isClusteredWithTTL = true;
                }
                
                const keyToUniquenessMap = new Map();
                allIndexes.forEach(index => {
                    const keyString = JSON.stringify(index.key);
                    if (!keyToUniquenessMap.has(keyString)) {
                        keyToUniquenessMap.set(keyString, new Set());
                    }
                    keyToUniquenessMap.get(keyString).add(index.unique || false);
                });

                const conflictingKeyStrings = new Set();
                keyToUniquenessMap.forEach((uniquenessSet, keyString) => {
                    if (uniquenessSet.size > 1) {
                        conflictingKeyStrings.add(keyString);
                    }
                });
                
                allIndexes.forEach(index => {
                    let indexUsage = {};
                    try {
                        const pipeline = [{ $indexStats: {} }, { $match: { name: index.name } }];
                        const usageCursor = currentDb.getCollection(collName).aggregate(pipeline, { cursor: {} });
                        if (usageCursor.hasNext()) { indexUsage = usageCursor.next(); }
                    } catch (e) {}

                    let hasEmptySort = false;
                    for (const field in index.key) {
                        if (index.key[field] === "") {
                            hasEmptySort = true;
                            break;
                        }
                    }

                    const keyString = JSON.stringify(index.key);
                    output.push({
                        section: "index_info",
                        output: {
                            ns: `${dbName}.${collName}`, name: index.name, key: keyString,
                            unique: index.unique || false, isTTL: index.hasOwnProperty('expireAfterSeconds'),
                            size: (stats.indexSizes && stats.indexSizes[index.name]) || 0,
                            accesses: Number((indexUsage.accesses && indexUsage.accesses.ops) || 0),
                            hasDuplicateKeyConflict: conflictingKeyStrings.has(keyString),
                            hasEmptySort: hasEmptySort,
                            fullDefinition: JSON.stringify(index)
                        }
                    });
                });

                try {
                    const searchIndexes = currentDb.getCollection(collName).getSearchIndexes();
                    if (searchIndexes.length > 0) {
                        hasAtlasSearchIndex = true;
                        searchIndexes.forEach(s_idx => {
                            output.push({
                                section: "search_index_info",
                                output: { ns: `${dbName}.${collName}`, name: s_idx.name, definition: JSON.stringify(s_idx) }
                            });
                        });
                    }
                } catch(e) { }
            }

            output.push({
                section: "collection_info",
                output: {
                    ns: `${dbName}.${collName}`, count: stats.count || 0, size: stats.size || 0,
                    storageSize: stats.storageSize || 0, totalIndexSize: stats.totalIndexSize || 0,
                    type: collInfo.type || 'collection',
                    isSharded: stats.sharded || false,
                    isTimeseries: collInfo.type === 'timeseries' || !!(collInfo.options && collInfo.options.timeseries),
                    isCapped: stats.capped || false, isClustered: isClustered, isView: collInfo.type === 'view', 
                    hasDotInName: dbName.includes('.') || collName.includes('.'),
                    hasQueryableEncryption: !!(collInfo.options && collInfo.options.encryptedFields),
                    isClusteredWithTTL: isClusteredWithTTL, hasAtlasSearchIndex: hasAtlasSearchIndex
                }
            });
        });
    });

    print(JSON.stringify(output, null, 2));
})();

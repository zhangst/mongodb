// FINAL VERSION
// 用法: mongo mongodb_collect32_final.js

(function() {
    'use strict';

    var output = [];
    var adminDb = db.getSiblingDB('admin');

    // --- Section 0: Cluster-wide Info ---
    try {
        var serverStatus = adminDb.runCommand({ serverStatus: 1 });
        var cmdLine = adminDb.runCommand({ getCmdLineOpts: 1 });
        var storageEngineName = 'unknown';
        if (serverStatus.storageEngine && serverStatus.storageEngine.name) {
            storageEngineName = serverStatus.storageEngine.name;
        } else {
            try {
                var configDb = db.getSiblingDB('config');
                var stats = configDb.collections.stats();
                if (stats && stats.hasOwnProperty('wiredTiger')) {
                    storageEngineName = 'wiredTiger';
                }
            } catch (e) { print("// Could not determine storage engine via fallback: " + e); }
        }
        var hasZones = false;
        var isBalancerRunning = false;
        if (serverStatus.process === 'mongos') {
            var configDb = db.getSiblingDB('config');
            if (configDb.tags.count({}) > 0) { hasZones = true; }
            isBalancerRunning = sh.getBalancerState();
        }
        output.push({
            section: "cluster_info",
            output: {
                version: serverStatus.version, storageEngine: storageEngineName, hasZones: hasZones,
                isBalancerRunning: isBalancerRunning, cmdLine: cmdLine.parsed,
                modules: serverStatus.modules ? JSON.stringify(serverStatus.modules) : "[]"
            }
        });
    } catch (e) { print("// Could not fetch cluster info: " + e); }

    var databases = adminDb.runCommand({ listDatabases: 1 }).databases;
    var excludeDbs = ["admin", "local", "config"];

    databases.forEach(function(dbInfo) {
        var dbName = dbInfo.name;
        if (excludeDbs.indexOf(dbName) > -1) return;

        var currentDb = db.getSiblingDB(dbName);
        var collectionInfos = currentDb.runCommand({ listCollections: 1 }).cursor.firstBatch;

        collectionInfos.forEach(function(collInfo) {
            var collName = collInfo.name;
            if (collName.substring(0, 7) === 'system.') return;

            var stats = {};
            try { stats = currentDb.getCollection(collName).stats({ scale: 1 }); } catch (e) {}

            var compression = 'none';
            if (stats.wiredTiger && stats.wiredTiger.creationString) {
                var match = stats.wiredTiger.creationString.match(/block_compressor=(\w+)/);
                if (match && match[1]) { compression = match[1]; }
            }
            var reusableBytes = (stats.wiredTiger && stats.wiredTiger['block-manager']) ? stats.wiredTiger['block-manager']['file bytes available for reuse'] : 0;
            
            // For 3.2, these will always be false, but keep logic for safety
            var isClustered = !!(collInfo.options && collInfo.options.clusteredIndex);
            var isClusteredWithTTL = false;
            var hasAtlasSearchIndex = false;

            // ==================== FINAL FIX START ====================
            // REMOVED the `if (collInfo.type === 'collection')` check as `type` field does not exist in MongoDB 3.2
            // All items from listCollections in 3.2 are collections, so we process them directly.
            try {
                var allIndexes = currentDb.getCollection(collName).getIndexes();

                if (isClustered) {
                    for (var i = 0; i < allIndexes.length; i++) {
                        if (allIndexes[i].hasOwnProperty('expireAfterSeconds')) {
                            isClusteredWithTTL = true;
                            break;
                        }
                    }
                }
                
                var keyToUniquenessMap = {};
                allIndexes.forEach(function(index) {
                    var keyString = JSON.stringify(index.key);
                    if (!keyToUniquenessMap.hasOwnProperty(keyString)) {
                        keyToUniquenessMap[keyString] = {};
                    }
                    keyToUniquenessMap[keyString][index.unique || false] = true;
                });
                var conflictingKeyStrings = [];
                for (var keyString in keyToUniquenessMap) {
                    if (keyToUniquenessMap.hasOwnProperty(keyString) && Object.keys(keyToUniquenessMap[keyString]).length > 1) {
                        conflictingKeyStrings.push(keyString);
                    }
                }

                allIndexes.forEach(function(index) {
                    var indexUsage = {};
                    try {
                        var pipeline = [{ $indexStats: {} }, { $match: { name: index.name } }];
                        var usageCursor = currentDb.getCollection(collName).aggregate(pipeline);
                        if (usageCursor.hasNext()) { indexUsage = usageCursor.next(); }
                    } catch (e) {}

                    var hasEmptySort = false;
                    for (var field in index.key) {
                        if (index.key.hasOwnProperty(field) && index.key[field] === "") {
                            hasEmptySort = true;
                            break;
                        }
                    }

                    var keyString = JSON.stringify(index.key);
                    output.push({
                        section: "index_info",
                        output: {
                            ns: dbName + "." + collName, name: index.name, key: keyString,
                            unique: index.unique || false, isTTL: index.hasOwnProperty('expireAfterSeconds'),
                            size: (stats.indexSizes && stats.indexSizes[index.name]) || 0,
                            accesses: Number((indexUsage.accesses && indexUsage.accesses.ops) || 0),
                            hasDuplicateKeyConflict: conflictingKeyStrings.indexOf(keyString) > -1,
                            hasEmptySort: hasEmptySort,
                            fullDefinition: JSON.stringify(index)
                        }
                    });
                });

                try {
                    var searchIndexes = currentDb.getCollection(collName).getSearchIndexes();
                    if (searchIndexes.length > 0) {
                        hasAtlasSearchIndex = true;
                        searchIndexes.forEach(function(s_idx) {
                            output.push({
                                section: "search_index_info",
                                output: { ns: dbName + "." + collName, name: s_idx.name, definition: JSON.stringify(s_idx) }
                            });
                        });
                    }
                } catch(e) { /* Method does not exist in 3.2, ignore error */ }
            } catch (e) {
                 print("// ERROR during index processing for collection '" + collName + "': " + e);
            }
            // ===================== FINAL FIX END =====================
            
            output.push({
                section: "collection_info",
                output: {
                    ns: dbName + "." + collName, count: stats.count || 0, size: stats.size || 0,
                    storageSize: stats.storageSize || 0, totalIndexSize: stats.totalIndexSize || 0,
                    type: 'collection', // Hardcode type as 'collection' for 3.2
                    isSharded: stats.sharded || false,
                    isTimeseries: false,
                    isCapped: stats.capped || false, isClustered: isClustered, isView: false,
                    hasDotInName: dbName.indexOf('.') > -1 || collName.indexOf('.') > -1,
                    hasQueryableEncryption: false,
                    isClusteredWithTTL: isClusteredWithTTL, hasAtlasSearchIndex: hasAtlasSearchIndex,
                    compression: compression,
                    reusableBytes: reusableBytes
                }
            });
        });
    });
    
    if (typeof printjson_safe === 'function') {
        printjson_safe(output);
    } else {
        printjson(output);
    }
})();

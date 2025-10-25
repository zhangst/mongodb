

var shardIndex = 0;
var targetShards = [
    "shard01",
    "shard02",
];

var maxChunksToSample = 100;


var collectionsToPresplit = [
    "my_sharded_db.users",
    "my_sharded_db.test",
];




if (!collectionsToPresplit || collectionsToPresplit.length === 0) {
    print("\nError: 'collectionsToPresplit' array is empty. Please edit the script.");
    exit(1); 
}


if (!targetShards || targetShards.length === 0) {
    print("\nError: 'targetShards' array is empty or seems to be using default placeholders.");
    exit(1); 
}


var ANSI_GREEN = "\x1b[32m";
var ANSI_RESET = "\x1b[0m";
print(`\nProcessing ${ANSI_GREEN}${collectionsToPresplit.length}${ANSI_RESET} collection(s) from SOURCE: ${ANSI_GREEN}${db.getMongo().host}${ANSI_RESET}`);
print(`Target shards for moveChunk (round-robin): ${ANSI_GREEN}${targetShards.join(', ')}${ANSI_RESET}`);
print(`Max split points to sample per collection: ${ANSI_GREEN}${maxChunksToSample}${ANSI_RESET}`);




var configDB = db.getSiblingDB('config');
var allCommands = []; 


collectionsToPresplit.forEach(function(ns) {
    print(`\n--- Processing: ${ANSI_GREEN}${ns}${ANSI_RESET} ---`);
    allCommands.push(`\n// Commands for: ${ANSI_GREEN}${ns}${ANSI_RESET}`);

    
    var collInfo = configDB.collections.findOne({ _id: ns }, { key: 1 });
    if (!collInfo || !collInfo.key || Object.keys(collInfo.key).length === 0) {
        print(`  Warning: Collection or shard key not found for '${ns}'. Skipping.`);
        allCommands.push(`// Warning: Skipped ${ns} - Collection or shard key not found on source.`);
        return; 
    }
    
    var shardKeyDoc = collInfo.key;
    var shardCmd = "sh.shardCollection(" + ns + ", " + JSON.stringify(shardKeyDoc) + ");";
    allCommands.push(shardCmd);

    
    var allSplitPoints = [];
    try {
        
        var chunksCursor = configDB.chunks.find({ns: ns}).sort({min: 1});
        var firstChunkSkipped = false;

        chunksCursor.forEach(function(chunk) {
            if (chunk.min) {
                
                // first chunk is $minkey, ignore
                if (firstChunkSkipped) {
                    allSplitPoints.push(chunk.min);
                } else {
                    firstChunkSkipped = true;
                }
            }
        });

    } catch (e) {
        print(`  Error fetching chunks for '${ns}': ${e}. Skipping split commands.`);
        allCommands.push(`// Error fetching chunks for ${ns}. Split commands skipped.`);
        return; 
    }

    

    var splitPoints = [];
    var totalSplitPoints = allSplitPoints.length;

    if (totalSplitPoints <= maxChunksToSample) {
        splitPoints = allSplitPoints;
    } else {
        
        var step = totalSplitPoints / maxChunksToSample;
        var seen = {};
        
        for (var i = 0; i < maxChunksToSample; i++) {
            var indexToPick = Math.floor(i * step);
            
            if (indexToPick >= totalSplitPoints) {
                break;
            }
            
            var point = allSplitPoints[indexToPick];
            var key = JSON.stringify(point); 

            if (!seen[key]) {
                splitPoints.push(point);
                seen[key] = true;
            }
        }
    }


    // --- 修改：命令生成逻辑 ---
    if (splitPoints.length === 0) {
        print(`  Info: No internal chunk boundaries found (maybe only 1 chunk).`);
    } else {
        print(`  Generating ${ANSI_GREEN}${splitPoints.length}${ANSI_RESET} split points and move commands...`);

        splitPoints.forEach(function(point) {
    

            var splitCmd = "sh.splitAt(" + ns + ", " + JSON.stringify(point) + ");";
            allCommands.push(splitCmd);


            var moveCmd = "sh.moveChunk(" + ns + ", " + JSON.stringify(point) + ", " + targetShards[shardIndex] + ");";
            allCommands.push(moveCmd);
            

            shardIndex = (shardIndex + 1) % targetShards.length;
        });
    }
});



print("\n\n\n\n// --- Start of Pre-split Commands (to run on DESTINATION cluster) ---");
allCommands.forEach(function(cmd){ print(cmd); });
print("\n// --- End of Pre-split Commands ---");

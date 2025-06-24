print('DB Name,Collection Name,Data Size(MB),Index Size(MB),storageSize(MB),Count,Sharded,TimeSeries,View,Validator,Capped');


const allDbs = db.getMongo().getDBs();
const excludeDbs = ["admin", "local", "config"];



allDbs.databases.forEach(dbInfo => {
    const dbName = dbInfo.name;
    if (excludeDbs.includes(dbName)) return;
    
    const database = db.getSiblingDB(dbName);
    let collInfos = [];
    
    try {
        collInfos = database.getCollectionInfos();
    } catch (e) {
        print(`// Error fetching collections for ${dbName}: ${e}`);
        return;
    }

    collInfos.forEach(coll => {
        const collName = coll.name;
        if (collName.startsWith('system.')) return;

        const isTimeSeries = coll.options.timeseries ? "Yes" : "No";
        const isView = coll.type === "view" ? "Yes" : "No";
        const hasValidation = coll.options.validator ? "Yes" : "No";

        let sizeMB = 0, indexSizeMB = 0;
        let isSharded = "No", Capped = "No";
        if (coll.type === "collection") {
            try {
                const stats = database[collName].stats({ scale: 1024 * 1024 });
                sizeMB = stats.size || 0;
                indexSizeMB = stats.totalIndexSize || 0;
                storageSize = stats.storageSize || 0;
                isSharded = stats.sharded ? "Yes" : "No";
                countNum = stats.count || 0;
                Capped = stats.capped ? "Yes" : "No";
            } catch (e) {
                sizeMB = indexSizeMB = isSharded = countNum = Capped = "Error";
            }
        }

        print(`${dbName},${collName},${sizeMB},${indexSizeMB},${storageSize},${countNum},${isSharded},${isTimeSeries},${isView},${hasValidation},${Capped}`);
    });
});

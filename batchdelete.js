
const dbName = 'test';
const collectionName = 'test';


const startTime = new Date("2025-05-15T11:42:00.000Z");
const endTime = new Date("2025-05-15T12:42:00.000Z");


const stepSeconds = 1;
const sleepMilliseconds = 700; 



const db = db.getSiblingDB(dbName);
const collection = db.getCollection(collectionName);

let currentTime = new Date(startTime.getTime());
let totalDeleted = 0;

print(`开始按时间批量删除文档，时间范围: ${startTime.toISOString()} 到 ${endTime.toISOString()}`);

while (currentTime <= endTime) {
    const deleteResult = collection.deleteMany({ "expired_at_date": { "$lt": currentTime } });

    const deletedCount = deleteResult.deletedCount;
    totalDeleted += deletedCount;

    const localTimeFormatted = new Date().toLocaleString();
    
    print(`${localTimeFormatted} | 删除 ${currentTime.toISOString()} 之前的文档: ${deletedCount} 条`);

    currentTime.setSeconds(currentTime.getSeconds() + stepSeconds);

    sleep(sleepMilliseconds);
}

print(`\n删除操作完成，共删除 ${totalDeleted} 条文档`);





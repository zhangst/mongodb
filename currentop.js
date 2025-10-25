// output field of currentOp: https://www.mongodb.com/docs/manual/reference/command/currentOp/#output-fields




////////// delete long running MQL earlier than 7.0
const maxExecutionTimeInSeconds = 0;
console.log(`Searching for queries running longer than ${maxExecutionTimeInSeconds} seconds...`);
db.currentOp(true).inprog.forEach(op => {
    if (op.secs_running > maxExecutionTimeInSeconds && op.op === 'query' && !op.ns.startsWith('local') && !op.ns.startsWith('admin')) {

        console.log(`Opid: ${op.opid} -  ${op.secs_running} seconds - Namespace: ${op.ns}`);
        printjson(op.command);

        try {
            db.killOp(op.opid);
            console.log(`---> Successfully sent kill signal to opid: ${op.opid}`);
        } catch (killError) {
            console.error(`---> Error killing opid ${op.opid}: ${killError.message}`);
        }
    }
});



///// after 7.0
const maxExecutionTimeInSeconds = 0;
console.log(`Searching for queries running longer than ${maxExecutionTimeInSeconds} seconds...`);
db.getSiblingDB("admin").aggregate( [{ $currentOp : { allUsers: true} }] ).forEach(op => {
    if (op.secs_running > maxExecutionTimeInSeconds && op.op === 'query' && !op.ns.startsWith('local') && !op.ns.startsWith('admin')) {

        console.log(`Opid: ${op.opid} -  ${op.secs_running} seconds - Namespace: ${op.ns}`);
        printjson(op.command);

        try {
            db.killOp(op.opid);
            console.log(`---> Successfully sent kill signal to opid: ${op.opid}`);
        } catch (killError) {
            console.error(`---> Error killing opid ${op.opid}: ${killError.message}`);
        }
    }
});

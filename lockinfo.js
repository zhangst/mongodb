// mongo --quiet --eval "load('lockinfo.js'); collectLockInfo();" > lockinfo.log
// lockinfo.js

function collectLockInfo() {
    for (var j = 0; j < 100; j++) {
        for (var i = 0; i < 10; i++) {
            var currentOp = JSON.stringify(db.currentOp());
            var lockInfo = JSON.stringify(db.getSiblingDB('admin').adminCommand({ lockInfo: 1 }));
            print('===================')
            print('Output: Run ' + j + ' Set ' + i)
            print('===================')
            print(currentOp, lockInfo);
            sleep(100);
        }
        sleep(1000);
    }
}

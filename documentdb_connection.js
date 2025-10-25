var connections = db.adminCommand({ aggregate: 1, pipeline: [{$currentOp: {allUsers: true, idleConnections: true}}], cursor: {} }).cursor.firstBatch;

var clients = {};

connections.forEach(function(conn) {
    if (conn.client) {
        var clientKey = conn.client;
        if (!clients[clientKey]) {
            clients[clientKey] = {
                count: 0,
                appNames: {}
            };
        }
        clients[clientKey].count++;
        if (conn.appName) {
            clients[clientKey].appNames[conn.appName] = 1;
        }
    }
});

var summary = [];
for (var client in clients) {
    summary.push({
        client: client,
        activeConnections: clients[client].count,
        appNames: Object.keys(clients[client].appNames)
    });
}

summary.sort(function(a, b) {
    return b.activeConnections - a.activeConnections;
});

printjson(summary);

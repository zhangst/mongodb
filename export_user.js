
// mongo --host <host> --port <port> --quiet export_user.js


var mdbBuiltInRoles = ["read", "readWrite", "dbAdmin", "userAdmin", "clusterAdmin",  "readAnyDatabase", "readWriteAnyDatabase", "userAdminAnyDatabase", "dbAdminAnyDatabase", "root"];


var databases = db.getMongo().getDBNames();


var roleCreationCommands = [];
var userCreationCommands = [];



function arrayIncludes(originalArray, valueToCheck) {
    for (var i = 0; i < originalArray.length; i++) {
        if (originalArray[i] === valueToCheck) {
            return true;
        }
    }
    return false;
}




databases.forEach(function(dbName) {
    var currentDB = db.getSiblingDB(dbName);
    

    if (dbName === "local" || dbName === "config") return;
    

    try {
        var roles = currentDB.system.roles.find();
        if (roles && roles.count() > 0) {
            roles.forEach(function(role) {
                if (!arrayIncludes(mdbBuiltInRoles, role.role)) {
                    roleCreationCommands.push("db.getSiblingDB(" + dbName + ").createRole({role: \"" + role.role + "\", privileges:"  + JSON.stringify(role.privileges, null, 0) + "}, roles:" + JSON.stringify(role.roles, null, 0) + ");\n");
                }
            });
        }
    } catch (e) {
        
    }

    
    var users = currentDB.system.users.find({ user: { $exists: true } });
    users.forEach(function(user) {
        // 跳过内部用户
        if (user.user === "__system") return;
        
        var userDB = user.db || dbName;
        var roles = [];

        if (user.roles && Array.isArray(user.roles)) {
            roles = user.roles.map(function(r) {
                // 处理格式："<db>.<role>" 或 全局角色
                if (typeof r === 'object' && r.role) return r;
                
                var parts = r.split('.');
                if (parts.length === 2) {
                    return { role: parts[1], db: parts[0] };
                } else if (arrayIncludes(mdbBuiltInRoles, r)) {
                    return { role: r, db: "admin" }; // 全局角色属于 admin 数据库
                } else {
                    return { role: r, db: userDB }; // 默认为当前数据库角色
                }
            });
        }

        print("u:" + userDB + " " + currentDB)
        userCreationCommands.push("db.getSiblingDB(" + userDB + ").createUser({user: \"" + user.user + "\", pwd: \"REPLACE_WITH_PASSWORD\", roles: " + JSON.stringify(roles, null, 0) + "});\n");
    });
});


print("\n\n// 角色 Role:");
roleCreationCommands.forEach(function(cmd) {
    print(cmd);
});

print("\n\n");

print("// 用户 User:(需要将 REPLACE_WITH_PASSWORD 替换为真实密码)");
userCreationCommands.forEach(function(cmd) {
    print(cmd);
});

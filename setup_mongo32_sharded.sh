#!/bin/bash

# --- 1. 安装依赖并下载 MongoDB 3.2 ---
echo ">>> Step 1: Installing dependencies and downloading MongoDB 3.2"
sudo yum install wget compat-openssl10 -y

# 设置 Locale 环境变量 (修复 mongo shell 启动错误)
export LC_ALL=en_US.UTF-8
export LANG=en_US.UTF-8
echo "export LC_ALL=en_US.UTF-8" >> ~/.bashrc
echo "export LANG=en_US.UTF-8" >> ~/.bashrc
source ~/.bashrc
echo "Locale set to en_US.UTF-8"

# 下载 MongoDB 3.2 - !!!请务必替换为有效的官方 3.2 下载链接!!!
# 以下链接仅为示例，可能已失效
MONGODB_DOWNLOAD_URL="https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-rhel70-3.2.22.tgz"
MONGODB_TARBALL=$(basename $MONGODB_DOWNLOAD_URL)
MONGODB_DIR=$(basename $MONGODB_TARBALL .tgz)

echo "Downloading MongoDB 3.2 from $MONGODB_DOWNLOAD_URL ..."
wget $MONGODB_DOWNLOAD_URL

if [ ! -f "$MONGODB_TARBALL" ]; then
    echo "Error: Failed to download MongoDB. Please check the URL."
    exit 1
fi

echo "Extracting MongoDB..."
tar -zxvf $MONGODB_TARBALL

echo "Copying binaries to /usr/local/bin..."
sudo cp $MONGODB_DIR/bin/* /usr/local/bin/

# 验证安装 (现在应该可以运行了)
echo "Verifying installation..."
mongod --version
mongos --version
mongo --version
echo "<<< Step 1 Complete"
echo ""

# --- 2. 创建目录结构和日志文件 ---
echo ">>> Step 2: Creating directories and log files"
sudo mkdir -p /data/mongo/config/c{1,2,3}
sudo mkdir -p /data/mongo/shard1/s{1,2,3}
sudo mkdir -p /data/mongo/shard2/s{4,5,6}
sudo mkdir -p /var/log/mongo/config
sudo mkdir -p /var/log/mongo/shard1
sudo mkdir -p /var/log/mongo/shard2
sudo mkdir -p /var/run/mongodb # PID 文件目录

# 创建日志文件并设置权限 (允许当前用户写入)
sudo touch /var/log/mongo/config/c{1,2,3}.log
sudo touch /var/log/mongo/shard1/s{1,2,3}.log
sudo touch /var/log/mongo/shard2/s{4,5,6}.log
sudo touch /var/log/mongo/mongos1.log
sudo touch /var/log/mongo/mongos2.log
sudo chown -R $(whoami):$(whoami) /var/log/mongo
sudo chown -R $(whoami):$(whoami) /var/run/mongodb
sudo chown -R $(whoami):$(whoami) /data/mongo # 允许当前用户写入数据目录

echo "<<< Step 2 Complete"
echo ""

# --- 3. 创建配置文件 ---
echo ">>> Step 3: Creating configuration files"

# Config Server 节点 1
sudo bash -c 'cat << EOF > /etc/mongod_c1.conf
storage:
  dbPath: /data/mongo/config/c1
  journal:
    enabled: true
systemLog:
  destination: file
  path: /var/log/mongo/config/c1.log
  logAppend: true
net:
  port: 27019
  bindIp: 127.0.0.1
sharding:
  clusterRole: configsvr
replication:
  replSetName: rsconfig
processManagement:
  fork: true
  pidFilePath: /var/run/mongodb/mongod_c1.pid
EOF'
echo "Created /etc/mongod_c1.conf"

# Config Server 节点 2
sudo bash -c 'cat << EOF > /etc/mongod_c2.conf
storage:
  dbPath: /data/mongo/config/c2
  journal:
    enabled: true
systemLog:
  destination: file
  path: /var/log/mongo/config/c2.log
  logAppend: true
net:
  port: 27020
  bindIp: 127.0.0.1
sharding:
  clusterRole: configsvr
replication:
  replSetName: rsconfig
processManagement:
  fork: true
  pidFilePath: /var/run/mongodb/mongod_c2.pid
EOF'
echo "Created /etc/mongod_c2.conf"

# Config Server 节点 3
sudo bash -c 'cat << EOF > /etc/mongod_c3.conf
storage:
  dbPath: /data/mongo/config/c3
  journal:
    enabled: true
systemLog:
  destination: file
  path: /var/log/mongo/config/c3.log
  logAppend: true
net:
  port: 27021
  bindIp: 127.0.0.1
sharding:
  clusterRole: configsvr
replication:
  replSetName: rsconfig
processManagement:
  fork: true
  pidFilePath: /var/run/mongodb/mongod_c3.pid
EOF'
echo "Created /etc/mongod_c3.conf"

# Shard 1 节点 1
sudo bash -c 'cat << EOF > /etc/mongod_s1.conf
storage:
  dbPath: /data/mongo/shard1/s1
  journal:
    enabled: true
systemLog:
  destination: file
  path: /var/log/mongo/shard1/s1.log
  logAppend: true
net:
  port: 27001
  bindIp: 127.0.0.1
sharding:
  clusterRole: shardsvr
replication:
  replSetName: rs1
processManagement:
  fork: true
  pidFilePath: /var/run/mongodb/mongod_s1.pid
EOF'
echo "Created /etc/mongod_s1.conf"

# Shard 1 节点 2
sudo bash -c 'cat << EOF > /etc/mongod_s2.conf
storage:
  dbPath: /data/mongo/shard1/s2
  journal:
    enabled: true
systemLog:
  destination: file
  path: /var/log/mongo/shard1/s2.log
  logAppend: true
net:
  port: 27002
  bindIp: 127.0.0.1
sharding:
  clusterRole: shardsvr
replication:
  replSetName: rs1
processManagement:
  fork: true
  pidFilePath: /var/run/mongodb/mongod_s2.pid
EOF'
echo "Created /etc/mongod_s2.conf"

# Shard 1 节点 3
sudo bash -c 'cat << EOF > /etc/mongod_s3.conf
storage:
  dbPath: /data/mongo/shard1/s3
  journal:
    enabled: true
systemLog:
  destination: file
  path: /var/log/mongo/shard1/s3.log
  logAppend: true
net:
  port: 27003
  bindIp: 127.0.0.1
sharding:
  clusterRole: shardsvr
replication:
  replSetName: rs1
processManagement:
  fork: true
  pidFilePath: /var/run/mongodb/mongod_s3.pid
EOF'
echo "Created /etc/mongod_s3.conf"

# Shard 2 节点 1 (s4)
sudo bash -c 'cat << EOF > /etc/mongod_s4.conf
storage:
  dbPath: /data/mongo/shard2/s4
  journal:
    enabled: true
systemLog:
  destination: file
  path: /var/log/mongo/shard2/s4.log
  logAppend: true
net:
  port: 27004
  bindIp: 127.0.0.1
sharding:
  clusterRole: shardsvr
replication:
  replSetName: rs2
processManagement:
  fork: true
  pidFilePath: /var/run/mongodb/mongod_s4.pid
EOF'
echo "Created /etc/mongod_s4.conf"

# Shard 2 节点 2 (s5)
sudo bash -c 'cat << EOF > /etc/mongod_s5.conf
storage:
  dbPath: /data/mongo/shard2/s5
  journal:
    enabled: true
systemLog:
  destination: file
  path: /var/log/mongo/shard2/s5.log
  logAppend: true
net:
  port: 27005
  bindIp: 127.0.0.1
sharding:
  clusterRole: shardsvr
replication:
  replSetName: rs2
processManagement:
  fork: true
  pidFilePath: /var/run/mongodb/mongod_s5.pid
EOF'
echo "Created /etc/mongod_s5.conf"

# Shard 2 节点 3 (s6)
sudo bash -c 'cat << EOF > /etc/mongod_s6.conf
storage:
  dbPath: /data/mongo/shard2/s6
  journal:
    enabled: true
systemLog:
  destination: file
  path: /var/log/mongo/shard2/s6.log
  logAppend: true
net:
  port: 27006
  bindIp: 127.0.0.1
sharding:
  clusterRole: shardsvr
replication:
  replSetName: rs2
processManagement:
  fork: true
  pidFilePath: /var/run/mongodb/mongod_s6.pid
EOF'
echo "Created /etc/mongod_s6.conf"

# Mongos 1
sudo bash -c 'cat << EOF > /etc/mongos1.conf
systemLog:
  destination: file
  path: /var/log/mongo/mongos1.log
  logAppend: true
net:
  port: 27017
  bindIp: 127.0.0.1
sharding:
  configDB: rsconfig/localhost:27019,localhost:27020,localhost:27021
processManagement:
  fork: true
  pidFilePath: /var/run/mongodb/mongos1.pid
EOF'
echo "Created /etc/mongos1.conf"

# Mongos 2
sudo bash -c 'cat << EOF > /etc/mongos2.conf
systemLog:
  destination: file
  path: /var/log/mongo/mongos2.log
  logAppend: true
net:
  port: 27018
  bindIp: 127.0.0.1
sharding:
  configDB: rsconfig/localhost:27019,localhost:27020,localhost:27021
processManagement:
  fork: true
  pidFilePath: /var/run/mongodb/mongos2.pid
EOF'
echo "Created /etc/mongos2.conf"

echo "<<< Step 3 Complete"
echo ""

# --- 4. 启动所有 mongod 实例 ---
echo ">>> Step 4: Starting all mongod instances"
mongod -f /etc/mongod_c1.conf && echo "Started mongod_c1 (Config)" || echo "Failed mongod_c1"
mongod -f /etc/mongod_c2.conf && echo "Started mongod_c2 (Config)" || echo "Failed mongod_c2"
mongod -f /etc/mongod_c3.conf && echo "Started mongod_c3 (Config)" || echo "Failed mongod_c3"
mongod -f /etc/mongod_s1.conf && echo "Started mongod_s1 (Shard1)" || echo "Failed mongod_s1"
mongod -f /etc/mongod_s2.conf && echo "Started mongod_s2 (Shard1)" || echo "Failed mongod_s2"
mongod -f /etc/mongod_s3.conf && echo "Started mongod_s3 (Shard1)" || echo "Failed mongod_s3"
mongod -f /etc/mongod_s4.conf && echo "Started mongod_s4 (Shard2)" || echo "Failed mongod_s4"
mongod -f /etc/mongod_s5.conf && echo "Started mongod_s5 (Shard2)" || echo "Failed mongod_s5"
mongod -f /etc/mongod_s6.conf && echo "Started mongod_s6 (Shard2)" || echo "Failed mongod_s6"

echo "Waiting a few seconds for instances to start..."
sleep 10
echo "<<< Step 4 Complete"
echo ""

# --- 5. 初始化副本集 ---
echo ">>> Step 5: Initializing replica sets"

# 初始化 Config Server 副本集 (rsconfig)
echo "Initializing rsconfig..."
mongo --port 27019 <<EOF
rs.initiate( {
   _id : "rsconfig",
   configsvr: true,
   members: [
      { _id: 0, host: "localhost:27019" },
      { _id: 1, host: "localhost:27020" },
      { _id: 2, host: "localhost:27021" }
   ]
})
EOF
sleep 5 # 等待选举完成

# 初始化 Shard 1 副本集 (rs1)
echo "Initializing rs1..."
mongo --port 27001 <<EOF
rs.initiate( {
   _id : "rs1",
   members: [
      { _id: 0, host: "localhost:27001" },
      { _id: 1, host: "localhost:27002" },
      { _id: 2, host: "localhost:27003" }
   ]
})
EOF
sleep 5

# 初始化 Shard 2 副本集 (rs2)
echo "Initializing rs2..."
mongo --port 27004 <<EOF
rs.initiate( {
   _id : "rs2",
   members: [
      { _id: 0, host: "localhost:27004" },
      { _id: 1, host: "localhost:27005" },
      { _id: 2, host: "localhost:27006" }
   ]
})
EOF
sleep 5

echo "<<< Step 5 Complete"
echo ""

# --- 6. 启动 mongos 实例 ---
echo ">>> Step 6: Starting mongos instances"
mongos -f /etc/mongos1.conf && echo "Started mongos1 (Port 27017)" || echo "Failed mongos1"
mongos -f /etc/mongos2.conf && echo "Started mongos2 (Port 27018)" || echo "Failed mongos2"
echo "Waiting a few seconds for mongos to connect..."
sleep 10
echo "<<< Step 6 Complete"
echo ""

# --- 7. 添加 Shards 到集群 ---
echo ">>> Step 7: Adding shards to the cluster"
mongo --port 27017 <<EOF
print("Adding Shard 1 (rs1)...")
sh.addShard("rs1/localhost:27001")
print("Adding Shard 2 (rs2)...")
sh.addShard("rs2/localhost:27004")
print("Current cluster status:")
sh.status()
EOF

echo "<<< Step 7 Complete"
echo ""

# --- 8. (可选) 启用分片 ---
echo ">>> Step 8: (Optional) Enable sharding for a database and collection"
# mongo --port 27017 <<EOF
# print("Enabling sharding for database 'testdb'...")
# sh.enableSharding("testdb")
# print("Sharding collection 'testdb.mycollection' with key 'userId' (hashed)...")
# sh.shardCollection("testdb.mycollection", { "userId": "hashed" } )
# print("Final cluster status:")
# sh.status()
# EOF
echo "If you wish to enable sharding, uncomment and run the commands in Step 8 manually via 'mongo --port 27017'"
echo "<<< Step 8 Complete"
echo ""

echo ">>> MongoDB 3.2 Sharded Cluster deployment script finished."
echo "Connect to mongos using: mongo --port 27017  or  mongo --port 27018"
echo "Remember the warnings: MongoDB 3.2 EOL, single-machine setup is for testing only, RHEL 8 compatibility issues may exist."

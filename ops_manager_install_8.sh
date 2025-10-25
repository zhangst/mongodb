#!/bin/bash


# Baisc pkg
sudo yum install -y wget



# Install Mongo for appDB
cat <<EOF | sudo tee /etc/yum.repos.d/mongodb-org-6.0.repo
[mongodb-org-6.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/8/mongodb-org/6.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://pgp.mongodb.com/server-6.0.asc
EOF


sudo yum install -y mongodb-org mongodb-mongosh


# Configure appDB
sudo mkdir -p /data/appdb/node{1,2,3}/{conf,logs,db}

cat <<ENDCONF | sudo tee /data/appdb/node1/conf/mongod.conf
# mongod.conf

# for documentation of all options, see:
# http://docs.mongodb.org/manual/reference/configuration-options/

systemLog:
  destination: file
  logAppend: true
  path: /data/appdb/node1/logs/mongod.log

# Where and how to store data.
storage:
  dbPath: /data/appdb/node1/db/

processManagement:
  fork: true  # fork and run in background
  pidFilePath: /data/appdb/node1/mongod.pid  # location of pidfile
  timeZoneInfo: /usr/share/zoneinfo

net:
  port: 37017
  bindIp: 0.0.0.0
  bindIpAll: true

replication:
  replSetName: mgappdb
ENDCONF


cat <<ENDCONF | sudo tee /data/appdb/node2/conf/mongod.conf
# mongod.conf

# for documentation of all options, see:
# http://docs.mongodb.org/manual/reference/configuration-options/

systemLog:
  destination: file
  logAppend: true
  path: /data/appdb/node2/logs/mongod.log

# Where and how to store data.
storage:
  dbPath: /data/appdb/node2/db/

processManagement:
  fork: true  # fork and run in background
  pidFilePath: /data/appdb/node2/mongod.pid  # location of pidfile
  timeZoneInfo: /usr/share/zoneinfo

net:
  port: 37018
  bindIp: 0.0.0.0
  bindIpAll: true

replication:
  replSetName: mgappdb
ENDCONF

cat <<ENDCONF | sudo tee /data/appdb/node3/conf/mongod.conf
# mongod.conf

# for documentation of all options, see:
# http://docs.mongodb.org/manual/reference/configuration-options/

systemLog:
  destination: file
  logAppend: true
  path: /data/appdb/node3/logs/mongod.log

# Where and how to store data.
storage:
  dbPath: /data/appdb/node3/db/

processManagement:
  fork: true  # fork and run in background
  pidFilePath: /data/appdb/node3/mongod.pid  # location of pidfile
  timeZoneInfo: /usr/share/zoneinfo

net:
  port: 37019
  bindIp: 0.0.0.0
  bindIpAll: true

replication:
  replSetName: mgappdb
ENDCONF


sudo useradd mongod
#sudo groupadd mongod
#sudo usermod -aG mongod mongod

sudo chown -R mongod:mongod /data


sudo -u mongod mongod -f /data/appdb/node1/conf/mongod.conf
sudo -u mongod mongod -f /data/appdb/node2/conf/mongod.conf
sudo -u mongod mongod -f /data/appdb/node3/conf/mongod.conf

sleep 10


mongosh --port=37017 --quiet --eval "rs.initiate({_id: \"mgappdb\", version: 1, members: [{ _id: 0, host : \"localhost:37017\" },{ _id: 1, host : \"localhost:37018\" },{ _id: 2, host : \"localhost:37019\" }]})"


sleep 15

mongosh "mongodb://127.0.0.1:37017/admin" --quiet --eval "db.createUser({user:'root', pwd:'opsmanager', roles:[{db:'admin',role:'root'}]})"
# mongosh "mongodb://root:opsmanager@127.0.0.1:37017/admin"


mongosh --port=37017 -u root -p opsmanager --eval "db.createUser({ user: 'opsManager', pwd: 'passwordone', roles: [ { role: 'readWriteAnyDatabase', db: 'admin' }, { role: 'dbAdminAnyDatabase', db: 'admin' }, { role: 'clusterAdmin', db: 'admin' }, { role: 'clusterMonitor', db: 'admin' } ]})" admin




# install opsmanager
# wget https://downloads.mongodb.com/on-prem-mms/rpm/mongodb-mms-6.0.7.100.20221129T1435Z.x86_64.rpm
# sudo rpm -ivh mongodb-mms-6.0.7.100.20221129T1435Z.x86_64.rpm
wget https://downloads.mongodb.com/on-prem-mms/rpm/mongodb-mms-8.0.2.500.20241205T1612Z.x86_64.rpm
sudo rpm -ivh mongodb-mms-8.0.2.500.20241205T1612Z.x86_64.rpm


cat << ENDCONF | sudo tee /opt/mongodb/mms/conf/conf-mms.properties
mongo.mongoUri=mongodb://opsManager:passwordone@127.0.0.1:37017,127.0.0.1:37018,127.0.0.1:37019/admin?maxPoolSize=150&retryWrites=false&retryReads=false
mongo.encryptedCredentials=false
mongo.ssl=false
ENDCONF


sudo setenforce 0
sudo systemctl stop firewalld


sudo systemctl start mongodb-mms.service


# 定义待查找的文本
SEARCH_TEXT1="Successfully finished pre-flight checks"
SEARCH_TEXT2="Started mms"

while true; do
  if sudo grep -q "$SEARCH_TEXT1" /var/log/messages; then
    echo "Found '$SEARCH_TEXT1' in /var/log/messages"
    break
  fi
  echo "Wait '$SEARCH_TEXT1' in /var/log/messages"
  sleep 5
done

while true; do
  if sudo grep -q "$SEARCH_TEXT2" /opt/mongodb/mms/logs/mms0.log; then
    echo "Found '$SEARCH_TEXT2' in /opt/mongodb/mms/logs/mms0.log"
    break
  fi
  echo "Wait '$SEARCH_TEXT2' in /opt/mongodb/mms/logs/mms0.log"
  sleep 5
done



echo "app-mms started ok!"

echo "1. need to configure AWS EC2 Security to add network permission to 8080"

echo "2. use ip to configure ops manager in chrome"

echo "3. install agent & active monitor and backup"

echo "4. install rpm depency, https://www.mongodb.com/docs/ops-manager/current/tutorial/provisioning-prep/index.html#installing-mongodb-enterprise-dependencies"


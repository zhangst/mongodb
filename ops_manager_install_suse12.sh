#!/bin/bash

# Baisc pkg
sudo zypper install -y wget



# Install Mongo for appDB
sudo mkdir /mongodb/
cd /mongodb/
sudo wget https://downloads.mongodb.com/linux/mongodb-linux-x86_64-enterprise-suse12-4.2.15.tgz
sudo wget https://downloads.mongodb.com/on-prem-mms/tar/mongodb-mms-4.4.16.100.20210804T2025Z-1.x86_64.tar.gz
sudo wget https://downloads.mongodb.com/compass/mongosh-1.10.6-linux-x64.tgz
sudo tar -zxvf mongodb-linux-x86_64-enterprise-suse12-4.2.15.tgz
sudo tar -zxvf mongodb-mms-4.4.16.100.20210804T2025Z-1.x86_64.tar.gz
sudo tar -zxvf mongosh-1.10.6-linux-x64.tgz


# Configure appDB
sudo mkdir -p /mongodata/db_app_rep{1,2,3}/{conf,logs,db}

cat <<ENDCONF | sudo tee /mongodata/db_app_rep1/conf/mongod.conf
# mongod.conf

# for documentation of all options, see:
# http://docs.mongodb.org/manual/reference/configuration-options/

systemLog:
  destination: file
  logAppend: true
  path: /mongodata/db_app_rep1/logs/mongod.log

# Where and how to store data.
storage:
  dbPath: /mongodata/db_app_rep1/db/
  journal:
    enabled: true

processManagement:
  fork: true  # fork and run in background
  pidFilePath: /mongodata/db_app_rep1/mongod.pid  # location of pidfile
  timeZoneInfo: /usr/share/zoneinfo

net:
  port: 27017
  bindIp: 0.0.0.0
  bindIpAll: true

replication:
  replSetName: mgappdb
ENDCONF


cat <<ENDCONF | sudo tee /mongodata/db_app_rep2/conf/mongod.conf
# mongod.conf

# for documentation of all options, see:
# http://docs.mongodb.org/manual/reference/configuration-options/

systemLog:
  destination: file
  logAppend: true
  path: /mongodata/db_app_rep2/logs/mongod.log

# Where and how to store data.
storage:
  dbPath: /mongodata/db_app_rep2/db/
  journal:
    enabled: true

processManagement:
  fork: true  # fork and run in background
  pidFilePath: /mongodata/db_app_rep2/mongod.pid  # location of pidfile
  timeZoneInfo: /usr/share/zoneinfo

net:
  port: 27018
  bindIp: 0.0.0.0
  bindIpAll: true

replication:
  replSetName: mgappdb
ENDCONF

cat <<ENDCONF | sudo tee /mongodata/db_app_rep3/conf/mongod.conf
# mongod.conf

# for documentation of all options, see:
# http://docs.mongodb.org/manual/reference/configuration-options/

systemLog:
  destination: file
  logAppend: true
  path: /mongodata/db_app_rep3/logs/mongod.log

# Where and how to store data.
storage:
  dbPath: /mongodata/db_app_rep3/db/
  journal:
    enabled: true

processManagement:
  fork: true  # fork and run in background
  pidFilePath: /mongodata/db_app_rep3/mongod.pid  # location of pidfile
  timeZoneInfo: /usr/share/zoneinfo

net:
  port: 27019
  bindIp: 0.0.0.0
  bindIpAll: true

replication:
  replSetName: mgappdb
ENDCONF


sudo zypper install cyrus-sasl cyrus-sasl-plain cyrus-sasl-gssapi krb5 libcurl4 libldap-2_4-2 libopenssl1_0_0 libsensors4 libsnmp30 libwrap0 liblzma5



#sudo useradd mongod
#sudo groupadd mongod
#sudo usermod -aG mongod mongod
sudo groupadd mongod
sudo useradd -r -M -g mongod mongod

sudo groupadd mongodb-mms
sudo useradd -r -M -g mongodb-mms mongodb-mms

sudo chown -R mongod:mongod /mongodata
sudo chown -R mongod:mongod /mongodb


sudo -u mongod /mongodb/mongodb-linux-x86_64-enterprise-suse12-4.2.15/bin/mongod -f /mongodata/db_app_rep1/conf/mongod.conf
sudo -u mongod /mongodb/mongodb-linux-x86_64-enterprise-suse12-4.2.15/bin/mongod -f /mongodata/db_app_rep2/conf/mongod.conf
sudo -u mongod /mongodb/mongodb-linux-x86_64-enterprise-suse12-4.2.15/bin/mongod -f /mongodata/db_app_rep3/conf/mongod.conf

sleep 10


export PATH=$PATH:"/mongodb/mongosh-1.10.6-linux-x64/bin:/mongodb/mongodb-linux-x86_64-enterprise-suse12-4.2.15/bin/"

mongosh --quiet --eval "rs.initiate({_id: \"mgappdb\", version: 1, members: [{ _id: 0, host : \"localhost:27017\" },{ _id: 1, host : \"localhost:27018\" },{ _id: 2, host : \"localhost:27019\" }]})"


sleep 15

mongosh "mongodb://127.0.0.1:27017/admin" --quiet --eval "db.createUser({user:'root', pwd:'opsmanager', roles:[{db:'admin',role:'root'}]})"
# mongo "mongodb://root:opsmanager@127.0.0.1:27017/admin"


mongosh -u root -p opsmanager --eval "db.createUser({ user: 'opsManager', pwd: 'passwordone', roles: [ { role: 'readWriteAnyDatabase', db: 'admin' }, { role: 'dbAdminAnyDatabase', db: 'admin' }, { role: 'clusterAdmin', db: 'admin' }, { role: 'clusterMonitor', db: 'admin' } ]})" admin




# install opsmanager
cd /mongodb/
wget https://downloads.mongodb.com/on-prem-mms/tar/mongodb-mms-4.4.16.100.20210804T2025Z-1.x86_64.tar.gz


cat << ENDCONF | sudo tee /mongodb/mongodb-mms-4.4.16.100.20210804T2025Z-1.x86_64/conf/conf-mms.properties
mongo.mongoUri=mongodb://opsManager:passwordone@127.0.0.1:27017,127.0.0.1:27018,127.0.0.1:27019/?maxPoolSize=150&retryWrites=false&retryReads=false
mongo.encryptedCredentials=false
mongo.ssl=false
ENDCONF

#MMS_USER=mongodb-mms
#ENC_KEY_PATH=/mongodb/.mongodb-mms/gen.key


mkdir -p /opt/mongodb/mms/mongodb-releases/
chown -R mongodb-mms:mongodb-mms /opt/mongodb/mms/mongodb-releases/


#mkdir -p /opt/.mongodb-mms
#openssl rand 24 > /opt/.mongodb-mms/gen.key
#chmod 400 /opt/.mongodb-mms/gen.key


chown -R mongodb-mms:mongodb-mms /mongodb/mongodb-mms*


sudo setenforce 0
sudo systemctl stop firewalld


ulimit -n 65535
ulimit -s 81920
echo "* hard nofile unlimited" >> /etc/security/limits.conf
echo "* soft nofile unlimited" >> /etc/security/limits.conf


# /etc/systemd/system.conf
# DefaultTasksMax
echo "DefaultTasksMax=51200" >> /etc/systemd/system.conf
systemctl daemon-reload

zypper install postfix
sudo postfix setup
sudo systemctl start postfix
sudo systemctl enable postfix


#ln -s /mongodb/mongodb-mms-4.4.16.100.20210804T2025Z-1.x86_64/bin/mongodb-mms /etc/init.d/mongodb-mms
#sudo systemctl enable mongodb-mms

#sudo systemctl start mongodb-mms.service
#service mongodb-mms start
sudo -u mongod /mongodb/mongodb-mms-4.4.16.100.20210804T2025Z-1.x86_64/bin/mongodb-mms start



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
  if sudo grep -q "$SEARCH_TEXT2" /mongodb/mongodb/mms/logs/mms0.log; then
    echo "Found '$SEARCH_TEXT2' in /mongodb/mongodb/mms/logs/mms0.log"
    break
  fi
  echo "Wait '$SEARCH_TEXT2' in /mongodb/mongodb/mms/logs/mms0.log"
  sleep 5
done



echo "app-mms started ok!"

echo "1. need to configure AWS EC2 Security to add network permission to 8080"

echo "2. use ip to configure ops manager in chrome"

echo "3. install agent & active monitor and backup"

echo "4. install rpm depency, https://www.mongodb.com/docs/ops-manager/current/tutorial/provisioning-prep/index.html#installing-mongodb-enterprise-dependencies"


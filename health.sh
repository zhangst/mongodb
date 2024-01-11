#!/bin/bash
# 脚本全部只读，不会会系统做任何修改
# 运行时需要使用 root 权限
# 运行命令:
#  chmod +x health.sh
# sudo ./health.sh > health_$(date +"%Y%m%d_%H%M%S").log 2>&1


# ANSI color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No color




echo -e "\n--------------------Logs Check--------------------\n"

# ops manager log
process_info=$(ps -ef | grep "mms-app" | grep -v "su -s")
log_path=$(echo "$process_info" | grep -o -E 'log_path=[^ ]+' | cut -d'=' -f2)
log_files=$(ls -al $log_path* | awk '{print $9}')

echo -e "Ops Manager Log File list: \n$log_files\n"
for file in $log_files
do

    echo -ne "$file: "
    
    if cat "$file" | grep -q "ERR"; then
        echo -e "${RED}Fail${NC}\n"
        cat "$file" | grep "ERR"
    else
        echo -e "${GREEN}Pass${NC}\n"
    fi

done


# mongod log
process_info=$(ps -ef | grep "mongod" | grep "mongod.conf" | grep -v "grep")
while IFS= read -r line; do
    
    conf_path=$(echo "$line" | awk -F"-f " '{print $2}')

    log_path=$(cat "$conf_path" | grep path | awk -F"path: " '{print $2}')

    log_files="$log_files $log_path"

done <<< "$process_info"

echo -e "\nmongod log files: \n$log_files\n"
for file in $log_files
do

    echo -ne "$file: "
    
    if cat "$file" | grep -q "ERR"; then
        echo -e "${RED}Fail${NC}\n"
        cat "$file" | grep "ERR"
    else
        echo -e "${GREEN}Pass${NC}\n"
    fi

done





# disk
echo -e "\n--------------------Disk Check--------------------\n"
disk_info=$(df -h | awk 'NR>1')

while IFS= read -r line; do

    directory=$(echo "$line" | awk '{print $NF}')
    usage_percent=$(echo "$line" | awk '{print $(NF-1)}' | sed 's/%//')


    if [ "$usage_percent" -gt 80 ]; then
        echo -e "$directory: ${RED}Fail($usage_percent%)${NC}"
    else
        echo -e "$directory: ${GREEN}Pass($usage_percent%)${NC}"
    fi
done <<< "$disk_info"




# mongod process ulimit check
echo -e "\n--------------------MongoD Limits Check--------------------\n"

process_info=$(ps -ef | grep "mongod" | grep "mongod.conf" | grep -v "grep")
echo "$process_info" | while IFS= read -r line; do

    pid=$(echo "$line" | awk '{print $2}')
    process=$(echo "$line" | awk '{print $8" "$9" "$10}')
    
    ulimit_info=$(cat "/proc/$pid/limits")

    check_limit() {
        current_value=$(echo "$ulimit_info" | grep -E "$1" | awk '{print $4}')
        suggestion=$2
        limit_name=$3

        if [ "$current_value" != "$suggestion" ]; then
            echo -e "$limit_name: ${RED}Fail${NC} (Now: $current_value，Suggest: $suggestion)"
        else
            echo -e "$limit_name: ${GREEN}Pass${NC}"
        fi
    }

    echo -e "\nProcess Name:$process,  PID:$pid:"
    check_limit "Max open files" 64000 "Max open files"
    check_limit "Max processes" 64000 "Max processes"
    check_limit "Max file locks" "unlimited" "Max file locks"
    check_limit "Max locked memory" "unlimited" "Max locked memory"
    check_limit "Max cpu time" "unlimited" "Max cpu time"
done




# Linux kernel Check
echo -e "\n--------------------Linux Kernel Check--------------------\n"

# disk read ahead
blockdev_report=$(blockdev --report | awk '{print $2}')
readahead_result="true"
readahead_value=0
for ra_value in $blockdev_report; do
    if (( ra_value < 8 )) || (( ra_value > 32 )); then
        readahead_result="false"
        readahead_value=$ra_value
    fi
done

echo -ne "Read ahead Result: "
if [ "$readahead_result" == "true" ]; then
    echo -e "${GREEN}Pass${NC}"
else
    echo -e "${RED}Fail${NC}(Now:$readahead_value, suggest:8-32)"
fi


echo -e "\nSysctl Result:"
check_sysctl_value() {
    sysctl_key="$1"
    expected_value="$2"
    comparison_operator="$3"
    actual_value=$(sysctl -n "$sysctl_key" 2>/dev/null)

    case "$comparison_operator" in
        "eq" | "==" | "=")
            condition="$actual_value -eq $expected_value";;
        "ne" | "!=")
            condition="$actual_value -ne $expected_value";;
        "lt" | "<")
            condition="$actual_value -lt $expected_value";;
        "le" | "<=")
            condition="$actual_value -le $expected_value";;
        "gt" | ">")
            condition="$actual_value -gt $expected_value";;
        "ge" | ">=")
            condition="$actual_value -ge $expected_value";;
        *)
            echo "Unsupported comparison operator: $comparison_operator"
            return;;
    esac

    if eval [ "$condition" ]; then
        echo -e "$sysctl_key - ${GREEN}Pass${NC}: $actual_value"
    else
        echo -e "$sysctl_key - ${RED}Fail${NC} (Now:$actual_value, Suggest: $expected_value)"
    fi
}

# Check sysctl values against the expected values with different comparison operators
check_sysctl_value "fs.file-max" "98000" "ge"
check_sysctl_value "kernel.pid_max" "64000" "ge"
check_sysctl_value "kernel.threads-max" "64000" "ge"
check_sysctl_value "vm.max_map_count" "102400" "ge"
check_sysctl_value "net.ipv4.tcp_keepalive_time" "120" "eq"

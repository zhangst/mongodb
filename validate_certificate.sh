#!/bin/bash

# ANSI color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No color

# Function to log verification result with color
log_verification_result() {
    cert_name="$1"
    result="$2"
    if [ "$result" == "Passed" ]; then
        echo -e "\nVerification of $cert_name: ${GREEN}$result${NC}"
    else
        echo -e "\nVerification of $cert_name: ${RED}$result${NC}"
    fi
}

# Function to extract certificate subject alternative names (SAN)
extract_san() {
    cert_file="$1"
    san=$(openssl x509 -noout -text -in "$cert_file" | grep -oP 'DNS:\K[^,]*' | tr '\n' ' ')
    echo "$san"
}

# Function to extract extended key usage
extract_extended_key_usage() {
    cert_file="$1"
    extended_key_usage=$(openssl x509 -noout -text -in "$cert_file" | awk '/Extended Key Usage:/{flag=1;next}/^\s*$/{flag=0}flag')
    echo "$extended_key_usage"
}

# Function to validate certificate
validate_certificate() {
    ca_crt="$1"
    server_crt="$2"
    min_validity_days="$3"

    # Verify certificate content
    if grep -q 'PRIVATE KEY' "$server_crt" && grep -q 'PRIVATE KEY' "$server_crt"; then
        log_verification_result "$server_crt RSA PRIVATE KEY" "Passed"
    else
        log_verification_result "$server_crt RSA PRIVATE KEY" "Failed: don't have private key"
        exit 1
    fi
    
    if grep -q 'BEGIN CERTIFICATE' "$server_crt" && grep -q 'END CERTIFICATE' "$server_crt"; then
        log_verification_result "$server_crt CERTIFICATE" "Passed"
    else
        log_verification_result "$server_crt CERTIFICATE" "Failed: don't have certificate"
        exit 1
    fi
    
    # Verify certificate chain
    verify_result=$(openssl verify -CAfile "$ca_crt" "$server_crt" 2>&1)
    if [ $? -ne 0 ]; then
        log_verification_result "Certificate chain(openssl verify -CAfile $ca_crt $server_crt)" "Failed: $verify_result"
        exit 1
    else
        log_verification_result "Certificate chain(openssl verify -CAfile $ca_crt $server_crt)" "Passed"
    fi

    # Verify server name
    server_name=$(hostname)
    san_domains=$(extract_san "$server_crt")
    #log_verification_result "Certificate domain" "Certificate SAN: $san_domains, Server Domain: $server_name"
    match_found=false

    for san_domain in $san_domains; do
        if [[ "$san_domain" == *"*"* ]]; then
            # Handle wildcard domain
            wildcard_domain=${san_domain#*.}
            if [[ "$server_name" == *"$wildcard_domain" ]]; then
                match_found=true
                break
            fi
        elif [ "$san_domain" == "$server_name" ]; then
            match_found=true
            break
        fi
    done

    if [ "$match_found" == "false" ]; then
        log_verification_result "Certificate name(Certificate SAN: $san_domains, Server Domain: $server_name)" "Failed: Certificate name doesn't match server name"
        exit 1
    else
        log_verification_result "Certificate name(Certificate SAN: $san_domains, Server Domain: $server_name)" "Passed"
    fi

    # Verify certificate validity period
    cert_not_after=$(openssl x509 -noout -enddate -in "$server_crt" | cut -d= -f2)
    cert_not_after_timestamp=$(date -d "$cert_not_after" +%s)
    current_timestamp=$(date +%s)
    validity_days="$(( (cert_not_after_timestamp - current_timestamp) / 86400 ))" # Calculate validity in days
    if [ "$validity_days" -le "$min_validity_days" ]; then
        log_verification_result "Certificate period validity(pem:$validity_days,req:$min_validity_days)" "Failed: Certificate not valid for at least $min_validity_days days"
        exit 1
    else
        log_verification_result "Certificate period validity(pem:$validity_days,req:$min_validity_days)" "Passed"
    fi

    # Verify Extended Key Usage
    extended_key_usage=$(extract_extended_key_usage "$server_crt")
    if [[ "$extended_key_usage" != *"TLS Web Server Authentication"* || "$extended_key_usage" != *"TLS Web Client Authentication"* ]]; then
        log_verification_result "Extended Key Usage" "Failed: Certificate lacks required Extended Key Usage"
        exit 1
    else
        log_verification_result "Extended Key Usage" "Passed"
    fi

    echo -e "\n${GREEN}Certificate validation passed.${NC}\n"
}

# Check if required arguments are provided
if [ $# -ne 3 ]; then
    echo "Usage: $0 <ca.crt> <server.pem> <min_validity_days>"
    exit 1
fi

# Call the validate_certificate function
validate_certificate "$1" "$2" "$3"


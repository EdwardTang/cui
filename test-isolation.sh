#!/bin/bash

echo "Testing CUI Instance Isolation"
echo "================================"
echo ""

# Test 1: Wrong token should be rejected
echo "Test 1: Port 3001 with wrong token:"
response=$(curl -s -H "Authorization: Bearer wrong_token" http://localhost:3001/api/config 2>&1)
if echo "$response" | grep -q "Unauthorized"; then
    echo "  ✓ Correctly rejected wrong token"
else
    echo "  ✗ ERROR: Accepted wrong token!"
    echo "    Response: $response"
fi

echo ""

# Test 2: Cross-instance token should be rejected  
echo "Test 2: Port 3001 with port 3002's token (37fd6fc7885f2985eb1809f6327d44a5):"
response=$(curl -s -H "Authorization: Bearer 37fd6fc7885f2985eb1809f6327d44a5" http://localhost:3001/api/config 2>&1)
if echo "$response" | grep -q "Unauthorized"; then
    echo "  ✓ Correctly rejected cross-instance token"
else
    echo "  ✗ ERROR: Accepted cross-instance token!"
    echo "    Response: $response"
fi

echo ""

# Test 3: Correct token should be accepted
echo "Test 3: Port 3002 with its own token (37fd6fc7885f2985eb1809f6327d44a5):"
response=$(curl -s -H "Authorization: Bearer 37fd6fc7885f2985eb1809f6327d44a5" http://localhost:3002/api/config 2>&1)
if echo "$response" | grep -q "machine_id"; then
    echo "  ✓ Correctly accepted valid token"
else
    echo "  ✗ ERROR: Rejected valid token!"
    echo "    Response: $response"
fi

echo ""

# Test 4: Port 3001 with its correct token
echo "Test 4: Port 3001 with its own token (b345ec2c92899a87079666668406c8e1):"
response=$(curl -s -H "Authorization: Bearer b345ec2c92899a87079666668406c8e1" http://localhost:3001/api/config 2>&1)
if echo "$response" | grep -q "machine_id"; then
    echo "  ✓ Correctly accepted valid token"
else
    echo "  ✗ ERROR: Rejected valid token!"
    echo "    Response: $response"
fi

echo ""
echo "================================"
echo "Isolation test complete!"
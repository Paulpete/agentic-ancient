#!/bin/bash

# Get all upgradable programs using Solana CLI
solana program show --programs --url mainnet-beta | grep -E "Program Id|Upgrade Authority" | paste - - | awk '{print $3, $7}'

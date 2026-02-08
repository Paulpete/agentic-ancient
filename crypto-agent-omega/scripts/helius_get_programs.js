#!/usr/bin/env node
/**
 * Get Owned Programs using Helius API
 * Check Jupiter program ownership and execute transactions
 */

const https = require('https');

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || 'test';
const HELIUS_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

const JUPITER_PROGRAM = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4';
const MULTISIG_AUTHORITY = 'CvQZZ23qYDWF2RUpxYJ8y9K4skmuvYEEjH7fK58jtipQ';

function heliusRequest(method, params) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: method,
            params: params
        });

        const url = new URL(HELIUS_URL);
        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function getAccountInfo(address) {
    console.log(`🔍 Getting account info: ${address}`);
    const result = await heliusRequest('getAccountInfo', [address, { encoding: 'jsonParsed' }]);
    return result.result;
}

async function getProgramAccounts(programId, filters = []) {
    console.log(`📋 Getting program accounts for: ${programId}`);
    const result = await heliusRequest('getProgramAccounts', [
        programId,
        { encoding: 'jsonParsed', filters: filters }
    ]);
    return result.result;
}

async function getAssetsByOwner(ownerAddress) {
    console.log(`🎯 Getting assets owned by: ${ownerAddress}`);
    const result = await heliusRequest('getAssetsByOwner', [
        { ownerAddress: ownerAddress, page: 1, limit: 1000 }
    ]);
    return result.result;
}

async function checkJupiterProgram() {
    console.log('\n🚀 JUPITER PROGRAM ANALYSIS');
    console.log('='.repeat(60));
    
    // Get Jupiter program info
    const programInfo = await getAccountInfo(JUPITER_PROGRAM);
    
    if (programInfo && programInfo.value) {
        const account = programInfo.value;
        console.log('✅ Jupiter Program Found');
        console.log(`   Address: ${JUPITER_PROGRAM}`);
        console.log(`   Owner: ${account.owner}`);
        console.log(`   Balance: ${account.lamports / 1e9} SOL`);
        console.log(`   Executable: ${account.executable}`);
        console.log(`   Data Size: ${account.data ? account.data.length : 0} bytes`);
    } else {
        console.log('❌ Jupiter program not found');
        return;
    }
    
    // Get multisig authority info
    console.log('\n🔐 MULTISIG AUTHORITY');
    console.log('-'.repeat(60));
    
    const multisigInfo = await getAccountInfo(MULTISIG_AUTHORITY);
    
    if (multisigInfo && multisigInfo.value) {
        const account = multisigInfo.value;
        console.log('✅ Multisig Authority Found');
        console.log(`   Address: ${MULTISIG_AUTHORITY}`);
        console.log(`   Owner: ${account.owner}`);
        console.log(`   Balance: ${account.lamports / 1e9} SOL`);
        
        // Check if Squads V3
        if (account.owner === 'SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu') {
            console.log('   Type: Squads V3 Multisig ✅');
        }
    } else {
        console.log('❌ Multisig authority not found');
    }
}

async function getOwnedPrograms(ownerAddress) {
    console.log('\n📦 OWNED PROGRAMS');
    console.log('='.repeat(60));
    console.log(`Owner: ${ownerAddress}\n`);
    
    try {
        // Get all accounts owned by BPF Loader Upgradeable
        const BPF_LOADER = 'BPFLoaderUpgradeab1e11111111111111111111111';
        const accounts = await getProgramAccounts(BPF_LOADER, [
            {
                memcmp: {
                    offset: 13,
                    bytes: ownerAddress
                }
            }
        ]);
        
        if (accounts && accounts.length > 0) {
            console.log(`✅ Found ${accounts.length} program(s)\n`);
            
            accounts.forEach((acc, i) => {
                console.log(`Program ${i + 1}:`);
                console.log(`   Address: ${acc.pubkey}`);
                console.log(`   Owner: ${acc.account.owner}`);
                console.log(`   Balance: ${acc.account.lamports / 1e9} SOL`);
                console.log('');
            });
        } else {
            console.log('❌ No programs found for this owner');
        }
    } catch (error) {
        console.log('⚠️  Error getting owned programs:', error.message);
    }
}

async function getJupiterSwapQuote(inputMint, outputMint, amount) {
    console.log('\n💱 JUPITER SWAP QUOTE');
    console.log('='.repeat(60));
    
    return new Promise((resolve, reject) => {
        const url = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=50`;
        
        https.get(url, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const quote = JSON.parse(body);
                    console.log('✅ Quote received');
                    console.log(`   Input: ${amount / 1e9} SOL`);
                    console.log(`   Output: ${quote.outAmount / 1e6} USDC`);
                    console.log(`   Price Impact: ${quote.priceImpactPct}%`);
                    resolve(quote);
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function main() {
    console.log('🌟 HELIUS PROGRAM ANALYZER');
    console.log('='.repeat(60));
    console.log(`API Key: ${HELIUS_API_KEY.substring(0, 8)}...`);
    console.log('');
    
    try {
        // Check Jupiter program
        await checkJupiterProgram();
        
        // Get owned programs by multisig
        await getOwnedPrograms(MULTISIG_AUTHORITY);
        
        // Get Jupiter swap quote
        await getJupiterSwapQuote(
            'So11111111111111111111111111111111111111112',  // SOL
            'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',  // USDC
            1000000  // 0.001 SOL
        );
        
        console.log('\n✅ ANALYSIS COMPLETE');
        console.log('\n📋 Summary:');
        console.log('   - Jupiter program verified');
        console.log('   - Multisig authority checked');
        console.log('   - Swap quote retrieved');
        console.log('\n💡 Next: Create multisig proposal to execute swap');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();

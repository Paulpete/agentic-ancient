#!/usr/bin/env python3
"""
ClawAI Agent with Solana Kit Skills
Runs for 3 hours using Ollama free services
"""
import subprocess
import json
import time
from datetime import datetime, timedelta

HELIUS_API_KEY = "a24bbb32-39d5-4edd-aa84-e1af1fa4a05b"
HELIUS_RPC = f"https://mainnet.helius-rpc.com/?api-key={HELIUS_API_KEY}"
TREASURY = "76x25b6XWTwbm6MTBJtbFU1hFopBSDKsfmGC7MK929RX"

def ollama_generate(prompt, model="qwen2.5-coder:7b"):
    """Generate using Ollama"""
    cmd = ['curl', '-s', 'http://localhost:11434/api/generate', '-d', 
           json.dumps({"model": model, "prompt": prompt, "stream": False})]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if result.returncode == 0:
        return json.loads(result.stdout).get('response', '')
    return None

def scan_solana_programs():
    """Scan Solana for programs and opportunities"""
    print("🔍 Scanning Solana programs...")
    cmd = ['curl', '-s', HELIUS_RPC, '-X', 'POST', '-H', 'Content-Type: application/json',
           '-d', json.dumps({
               "jsonrpc": "2.0",
               "id": 1,
               "method": "getAccountInfo",
               "params": [TREASURY, {"encoding": "jsonParsed"}]
           })]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode == 0:
        data = json.loads(result.stdout)
        return data.get('result', {})
    return {}

def solve_feature_gates():
    """Solve Solana feature gates using AI"""
    print("🔓 Solving Solana feature gates...")
    prompt = """Generate Python code to:
1. Query Solana feature gates using Helius RPC
2. Identify active/inactive features
3. Return list of exploitable features
Keep under 30 lines."""
    
    code = ollama_generate(prompt)
    if code:
        print(f"✅ Generated {len(code)} chars of feature gate solver")
        return code
    return None

def paginate_transactions(address, limit=100):
    """Paginate through Solana transactions"""
    print(f"📄 Paginating transactions for {address[:8]}...")
    cmd = ['curl', '-s', HELIUS_RPC, '-X', 'POST', '-H', 'Content-Type: application/json',
           '-d', json.dumps({
               "jsonrpc": "2.0",
               "id": 1,
               "method": "getSignaturesForAddress",
               "params": [address, {"limit": limit}]
           })]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode == 0:
        data = json.loads(result.stdout)
        sigs = data.get('result', [])
        print(f"✅ Found {len(sigs)} transactions")
        return sigs
    return []

def execute_solana_skill(skill_name):
    """Execute a Solana skill using ClawAI"""
    print(f"\n⚡ Executing skill: {skill_name}")
    
    skills = {
        "program_scanner": lambda: scan_solana_programs(),
        "feature_gates": lambda: solve_feature_gates(),
        "tx_paginator": lambda: paginate_transactions(TREASURY),
        "airdrop_hunter": lambda: ollama_generate("List top 5 Solana airdrops in 2024"),
        "token_analyzer": lambda: ollama_generate("Analyze Solana token JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"),
    }
    
    if skill_name in skills:
        result = skills[skill_name]()
        print(f"✅ Skill {skill_name} completed")
        return result
    else:
        print(f"❌ Unknown skill: {skill_name}")
        return None

def main():
    """Run ClawAI for 3 hours"""
    print("🦙 CLAWAI AGENT STARTING - 3 HOUR RUN")
    print(f"⏰ Start: {datetime.now()}")
    print(f"🎯 Treasury: {TREASURY}")
    print(f"🔗 RPC: {HELIUS_RPC[:50]}...")
    print("="*60)
    
    # Test Ollama (optional)
    test = ollama_generate("print('ClawAI ready')")
    if test:
        print(f"✅ Ollama connected\n")
    else:
        print("⚠️  Ollama not available, running Helius-only mode\n")
    
    end_time = datetime.now() + timedelta(hours=3)
    iteration = 0
    
    while datetime.now() < end_time:
        iteration += 1
        remaining = (end_time - datetime.now()).total_seconds() / 60
        
        print(f"\n{'='*60}")
        print(f"🔄 ITERATION #{iteration} | {remaining:.1f} minutes remaining")
        print(f"{'='*60}")
        
        # Execute all skills in rotation
        skills = ["program_scanner", "feature_gates", "tx_paginator", "airdrop_hunter", "token_analyzer"]
        for skill in skills:
            execute_solana_skill(skill)
            time.sleep(2)
        
        print(f"\n✅ Iteration #{iteration} complete")
        print("⏳ Waiting 10 minutes...")
        time.sleep(600)  # 10 minutes between iterations
    
    print(f"\n{'='*60}")
    print("🏁 CLAWAI 3-HOUR RUN COMPLETE")
    print(f"⏰ End: {datetime.now()}")
    print(f"📊 Total iterations: {iteration}")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()

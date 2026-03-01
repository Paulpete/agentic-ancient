#!/usr/bin/env python3
"""
Repository Analyzer - Scans all files and generates deployment manifest
"""
import os
import json
from pathlib import Path

class RepoAnalyzer:
    def __init__(self, root_path="."):
        self.root = Path(root_path)
        self.manifest = {
            "core_files": [],
            "workflows": [],
            "agents": [],
            "integrations": [],
            "configs": []
        }
    
    def scan(self):
        """Scan repository structure"""
        print("🔍 Analyzing repository structure...")
        
        # Core files in root
        for f in self.root.glob("*.py"):
            if f.name not in ["db_script.py"]:
                self.manifest["core_files"].append(str(f))
        
        # Workflows
        workflows_dir = self.root / ".github" / "workflows"
        if workflows_dir.exists():
            for f in workflows_dir.glob("*.yml"):
                self.manifest["workflows"].append(str(f))
        
        # Omega agents
        omega_dir = self.root / "crypto-agent-omega" / "agent"
        if omega_dir.exists():
            for f in omega_dir.rglob("*.py"):
                self.manifest["agents"].append(str(f))
        
        # Integrations
        for pattern in ["lib/**/*.ts", "lib/**/*.py"]:
            for f in self.root.glob(pattern):
                self.manifest["integrations"].append(str(f))
        
        # Configs
        for f in self.root.glob("*.json"):
            if f.name not in ["package-lock.json"]:
                self.manifest["configs"].append(str(f))
        
        return self.manifest
    
    def generate_report(self):
        """Generate analysis report"""
        manifest = self.scan()
        
        print("\n📊 REPOSITORY ANALYSIS")
        print("=" * 50)
        print(f"Core files: {len(manifest['core_files'])}")
        print(f"Workflows: {len(manifest['workflows'])}")
        print(f"Agents: {len(manifest['agents'])}")
        print(f"Integrations: {len(manifest['integrations'])}")
        print(f"Configs: {len(manifest['configs'])}")
        
        print("\n🎯 CRITICAL FILES FOR DEPLOYMENT:")
        print("- omega_prime.py (main orchestrator)")
        print("- omega_config.json (unified config)")
        print("- .github/workflows/omega-eternal.yml")
        print("- .github/workflows/clawaibot.yml")
        print("- crypto-agent-omega/agent/* (all agents)")
        
        # Save manifest
        with open("deployment_manifest.json", "w") as f:
            json.dump(manifest, f, indent=2)
        
        print("\n✅ Manifest saved to deployment_manifest.json")
        return manifest

if __name__ == "__main__":
    analyzer = RepoAnalyzer()
    analyzer.generate_report()

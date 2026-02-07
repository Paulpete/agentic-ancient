#!/usr/bin/env python3
"""
WebApp Integration Client - Connects Helix Nexus to Empire Infinity Matrix.
Real-time synchronization with your Replit webapp.
"""
import json
import urllib.request
import urllib.parse
import urllib.error
from typing import Dict, Any, List, Optional
from datetime import datetime
from dataclasses import dataclass, asdict

@dataclass
class HelixStatus:
    """Status message format for webapp."""
    timestamp: str
    type: str
    data: Dict[str, Any]
    source: str = "helix-nexus"

class EmpireWebAppClient:
    """Client for Empire Infinity Matrix webapp integration."""
    
    def __init__(self, primary_url: str, fallback_url: Optional[str] = None):
        self.primary_url = primary_url.rstrip('/')
        self.fallback_url = fallback_url.rstrip('/') if fallback_url else None
        self.active_url = self.primary_url
        self.connection_healthy = False
        
        # Test connection
        self.health_check()
    
    def health_check(self) -> bool:
        """Check if webapp is reachable."""
        try:
            # Try to fetch root
            req = urllib.request.Request(
                self.active_url,
                headers={'User-Agent': 'HelixNexus/1.0'}
            )
            
            with urllib.request.urlopen(req, timeout=5) as response:
                self.connection_healthy = (response.status == 200)
                if self.connection_healthy:
                    print(f"✓ WebApp connection: {self.active_url}")
                return self.connection_healthy
                
        except Exception as e:
            print(f"⚠ WebApp unreachable: {e}")
            
            # Try fallback
            if self.fallback_url and self.active_url != self.fallback_url:
                self.active_url = self.fallback_url
                return self.health_check()
            
            self.connection_healthy = False
            return False
    
    def send_helix_status(self, status_type: str, data: Dict[str, Any]) -> bool:
        """Send status update to webapp."""
        if not self.connection_healthy:
            # Try to reconnect
            if not self.health_check():
                print("✗ Cannot send status - webapp offline")
                return False
        
        status = HelixStatus(
            timestamp=datetime.utcnow().isoformat() + 'Z',
            type=status_type,
            data=data
        )
        
        try:
            # Try different API endpoints
            endpoints = [
                '/api/helix/status',
                '/api/status',
                '/helix/update',
                '/status'
            ]
            
            payload = json.dumps(asdict(status)).encode('utf-8')
            
            for endpoint in endpoints:
                try:
                    req = urllib.request.Request(
                        f"{self.active_url}{endpoint}",
                        data=payload,
                        headers={
                            'Content-Type': 'application/json',
                            'User-Agent': 'HelixNexus/1.0',
                            'X-Helix-Source': 'genesis-cascade'
                        },
                        method='POST'
                    )
                    
                    with urllib.request.urlopen(req, timeout=5) as response:
                        if response.status == 200:
                            print(f"✓ Status sent: {status_type}")
                            return True
                        
                except urllib.error.HTTPError as e:
                    if e.code == 404:
                        continue  # Try next endpoint
                    else:
                        raise
            
            # If all endpoints fail, just log locally
            print(f"✗ All endpoints unreachable, logging locally: {status_type}")
            self._log_locally(status)
            return False
            
        except Exception as e:
            print(f"✗ Status send failed: {e}")
            self._log_locally(status)
            return False
    
    def _log_locally(self, status: HelixStatus):
        """Fallback: log status locally if webapp is down."""
        log_dir = Path.home() / '.helix-nexus' / 'webapp-logs'
        log_dir.mkdir(parents=True, exist_ok=True)
        
        log_file = log_dir / f"status_{datetime.utcnow().strftime('%Y%m%d')}.jsonl"
        
        with open(log_file, 'a') as f:
            f.write(json.dumps(asdict(status)) + '\n')
    
    def send_skill_ecosystem_snapshot(self, skills: List[Dict[str, Any]]):
        """Send complete skill ecosystem snapshot."""
        return self.send_helix_status('ecosystem_snapshot', {
            'skills': skills,
            'total_count': len(skills),
            'active_count': len([s for s in skills if s.get('status') == 'active'])
        })
    
    def send_task_execution_log(self, task_id: str, skill: str, result: str, duration_ms: float):
        """Log task execution details."""
        return self.send_helix_status('task_execution', {
            'task_id': task_id,
            'skill': skill,
            'result': result,
            'duration_ms': duration_ms,
            'success': 'error' not in result.lower()
        })
    
    def send_mutation_proposal(self, mutation: Dict[str, Any]):
        """Send genetic algorithm mutation proposal."""
        return self.send_helix_status('mutation_proposal', mutation)
    
    def send_heartbeat(self, ecosystem_health: Dict[str, Any]):
        """Send regular heartbeat with system health."""
        return self.send_helix_status('heartbeat', {
            'health': ecosystem_health,
            'uptime_hours': self._calculate_uptime()
        })
    
    def _calculate_uptime(self) -> float:
        """Calculate system uptime (placeholder)."""
        # In real implementation, track start time
        return 0.0
    
    def fetch_webapp_config(self) -> Optional[Dict[str, Any]]:
        """Fetch configuration from webapp."""
        try:
            req = urllib.request.Request(
                f"{self.active_url}/api/helix/config",
                headers={'User-Agent': 'HelixNexus/1.0'}
            )
            
            with urllib.request.urlopen(req, timeout=5) as response:
                return json.loads(response.read())
                
        except Exception as e:
            print(f"⚠ Cannot fetch config: {e}")
            return None
    
    def register_helix_instance(self, instance_id: str, capabilities: List[str]):
        """Register this Helix instance with webapp."""
        return self.send_helix_status('registration', {
            'instance_id': instance_id,
            'capabilities': capabilities,
            'version': '1.0.0-genesis',
            'genesis_cascade': True
        })

from pathlib import Path

def main():
    """CLI for webapp integration."""
    import sys
    
    if len(sys.argv) < 3:
        print("Usage:")
        print("  webapp_client.py test <url>")
        print("  webapp_client.py send <url> <type> <data-json>")
        print("  webapp_client.py heartbeat <url>")
        sys.exit(1)
    
    command = sys.argv[1]
    url = sys.argv[2]
    
    # Check for fallback URL
    fallback = sys.argv[3] if len(sys.argv) > 3 and command != 'send' else None
    
    client = EmpireWebAppClient(url, fallback)
    
    if command == 'test':
        result = client.health_check()
        print(f"✓ Connection test: {'PASS' if result else 'FAIL'}")
    
    elif command == 'send':
        if len(sys.argv) < 5:
            print("Error: Missing type or data")
            sys.exit(1)
        
        status_type = sys.argv[3]
        data = json.loads(sys.argv[4])
        
        result = client.send_helix_status(status_type, data)
        print(f"✓ Send result: {'SUCCESS' if result else 'FAILED'}")
    
    elif command == 'heartbeat':
        result = client.send_heartbeat({
            'status': 'online',
            'skills_active': 5,
            'last_mutation': datetime.utcnow().isoformat()
        })
        print(f"✓ Heartbeat: {'SENT' if result else 'FAILED'}")
    
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)

if __name__ == "__main__":
    main()

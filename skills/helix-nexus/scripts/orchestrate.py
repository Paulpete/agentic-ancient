#!/usr/bin/env python3
"""
Helix Nexus Orchestrator - Master coordination engine for skill ecosystem.
Includes webapp integration for Empire Infinity Matrix.
"""
import json
import os
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from datetime import datetime
import urllib.request
import urllib.parse

@dataclass
class Skill:
    """Represents a skill in the ecosystem."""
    name: str
    description: str
    capabilities: List[str]
    triggers: List[str]
    location: str
    status: str = "active"
    
@dataclass
class Task:
    """Represents a decomposed task."""
    id: str
    skill: str
    action: str
    dependencies: List[str]
    priority: int
    status: str = "pending"

class SkillRegistry:
    """Registry of all available skills and their capabilities."""
    
    def __init__(self, skills_dir: str = "/mnt/skills"):
        self.skills_dir = Path(skills_dir)
        self.skills: Dict[str, Skill] = {}
        self.scan_skills()
    
    def scan_skills(self):
        """Scan available skills and register them."""
        # Scan public skills
        public_dir = self.skills_dir / "public"
        if public_dir.exists():
            for skill_dir in public_dir.iterdir():
                if skill_dir.is_dir() and (skill_dir / "SKILL.md").exists():
                    self._register_skill(skill_dir)
        
        # Scan user skills
        user_dir = self.skills_dir / "user"
        if user_dir.exists():
            for skill_dir in user_dir.iterdir():
                if skill_dir.is_dir() and (skill_dir / "SKILL.md").exists():
                    self._register_skill(skill_dir)
        
        # Scan example skills
        example_dir = self.skills_dir / "examples"
        if example_dir.exists():
            for skill_dir in example_dir.iterdir():
                if skill_dir.is_dir() and (skill_dir / "SKILL.md").exists():
                    self._register_skill(skill_dir)
    
    def _register_skill(self, skill_dir: Path):
        """Register a single skill."""
        skill_md = skill_dir / "SKILL.md"
        
        # Parse frontmatter
        with open(skill_md) as f:
            content = f.read()
            
        if content.startswith('---'):
            _, frontmatter, _ = content.split('---', 2)
            lines = frontmatter.strip().split('\n')
            
            name = None
            description = None
            
            for line in lines:
                if line.startswith('name:'):
                    name = line.split(':', 1)[1].strip()
                elif line.startswith('description:'):
                    description = line.split(':', 1)[1].strip()
            
            if name and description:
                # Extract capabilities and triggers from description
                capabilities = self._extract_capabilities(description)
                triggers = self._extract_triggers(description)
                
                skill = Skill(
                    name=name,
                    description=description,
                    capabilities=capabilities,
                    triggers=triggers,
                    location=str(skill_dir)
                )
                
                self.skills[name] = skill
    
    def _extract_capabilities(self, description: str) -> List[str]:
        """Extract capabilities from description."""
        capabilities = []
        keywords = ['create', 'edit', 'analyze', 'generate', 'process', 'extract', 
                   'convert', 'optimize', 'detect', 'compare', 'manage', 'monitor']
        
        for keyword in keywords:
            if keyword in description.lower():
                capabilities.append(keyword)
        
        return capabilities
    
    def _extract_triggers(self, description: str) -> List[str]:
        """Extract trigger phrases from description."""
        triggers = []
        
        # Look for common trigger patterns
        if 'Use when' in description:
            trigger_section = description.split('Use when')[1].split('.')[0]
            triggers.append(trigger_section.strip())
        
        if 'Triggers include' in description:
            trigger_section = description.split('Triggers include')[1].split('.')[0]
            triggers.extend([t.strip() for t in trigger_section.split(',')])
        
        return triggers
    
    def find_skills_for_task(self, task: str) -> List[Skill]:
        """Find skills that can handle a given task."""
        relevant_skills = []
        task_lower = task.lower()
        
        for skill in self.skills.values():
            # Check description
            if any(trigger.lower() in task_lower for trigger in skill.triggers):
                relevant_skills.append(skill)
            # Check capabilities
            elif any(cap in task_lower for cap in skill.capabilities):
                relevant_skills.append(skill)
        
        return relevant_skills
    
    def get_skill(self, name: str) -> Optional[Skill]:
        """Get a specific skill by name."""
        return self.skills.get(name)
    
    def list_all_skills(self) -> List[Skill]:
        """List all registered skills."""
        return list(self.skills.values())

class WebAppIntegration:
    """Integration with Empire Infinity Matrix webapp."""
    
    def __init__(self, app_urls: List[str]):
        self.app_urls = app_urls
        self.active_url = app_urls[0] if app_urls else None
    
    def send_status_update(self, status: Dict[str, Any]) -> bool:
        """Send status update to webapp."""
        if not self.active_url:
            return False
        
        try:
            # Try to send to webapp API endpoint
            data = json.dumps(status).encode('utf-8')
            req = urllib.request.Request(
                f"{self.active_url}/api/helix/status",
                data=data,
                headers={'Content-Type': 'application/json'}
            )
            
            with urllib.request.urlopen(req, timeout=5) as response:
                return response.status == 200
        except Exception as e:
            print(f"WebApp integration error: {e}")
            # Try fallback URL
            if len(self.app_urls) > 1 and self.active_url != self.app_urls[1]:
                self.active_url = self.app_urls[1]
                return self.send_status_update(status)
            return False
    
    def log_task_execution(self, task: Task, result: str):
        """Log task execution to webapp."""
        log_data = {
            'timestamp': datetime.utcnow().isoformat(),
            'task_id': task.id,
            'skill': task.skill,
            'action': task.action,
            'result': result,
            'status': task.status
        }
        
        self.send_status_update({
            'type': 'task_log',
            'data': log_data
        })
    
    def send_helix_heartbeat(self, registry: SkillRegistry):
        """Send heartbeat with current skill ecosystem status."""
        heartbeat = {
            'type': 'heartbeat',
            'timestamp': datetime.utcnow().isoformat(),
            'skills_active': len([s for s in registry.skills.values() if s.status == 'active']),
            'skills_total': len(registry.skills),
            'capabilities': list(set(cap for s in registry.skills.values() for cap in s.capabilities))
        }
        
        return self.send_status_update(heartbeat)

class TaskPlanner:
    """Decomposes complex requests into executable task graphs."""
    
    def __init__(self, registry: SkillRegistry):
        self.registry = registry
        self.task_counter = 0
    
    def decompose(self, user_request: str) -> List[Task]:
        """Decompose a user request into tasks."""
        tasks = []
        
        # Find relevant skills
        relevant_skills = self.registry.find_skills_for_task(user_request)
        
        if not relevant_skills:
            # No direct skill match - create a research task
            tasks.append(Task(
                id=self._next_id(),
                skill='helix-nexus',
                action='research_and_propose',
                dependencies=[],
                priority=1
            ))
        else:
            # Create tasks for each relevant skill
            for skill in relevant_skills:
                tasks.append(Task(
                    id=self._next_id(),
                    skill=skill.name,
                    action=self._infer_action(user_request, skill),
                    dependencies=[],
                    priority=self._calculate_priority(skill, user_request)
                ))
        
        # Sort by priority
        tasks.sort(key=lambda t: t.priority, reverse=True)
        
        return tasks
    
    def _next_id(self) -> str:
        """Generate next task ID."""
        self.task_counter += 1
        return f"task_{self.task_counter:04d}"
    
    def _infer_action(self, request: str, skill: Skill) -> str:
        """Infer the action based on request and skill."""
        request_lower = request.lower()
        
        action_keywords = {
            'create': ['create', 'make', 'build', 'generate'],
            'analyze': ['analyze', 'check', 'inspect', 'diagnose'],
            'optimize': ['optimize', 'improve', 'enhance'],
            'extract': ['extract', 'get', 'retrieve', 'fetch'],
            'compare': ['compare', 'diff', 'contrast']
        }
        
        for action, keywords in action_keywords.items():
            if any(kw in request_lower for kw in keywords):
                return action
        
        return 'execute'
    
    def _calculate_priority(self, skill: Skill, request: str) -> int:
        """Calculate task priority."""
        priority = 5  # Base priority
        
        # Boost priority if skill name directly mentioned
        if skill.name.lower() in request.lower():
            priority += 3
        
        # Boost if multiple capabilities match
        matching_caps = sum(1 for cap in skill.capabilities if cap in request.lower())
        priority += matching_caps
        
        return priority

class HelixOrchestrator:
    """Master orchestrator that coordinates the entire skill ecosystem."""
    
    def __init__(self, app_urls: List[str] = None):
        print("🧬 Initializing Helix Nexus Orchestrator...")
        self.registry = SkillRegistry()
        self.planner = TaskPlanner(self.registry)
        self.webapp = WebAppIntegration(app_urls or [])
        
        print(f"✓ Registered {len(self.registry.skills)} skills")
        
        # Send initial heartbeat
        if app_urls:
            self.webapp.send_helix_heartbeat(self.registry)
    
    def process_request(self, request: str) -> Dict[str, Any]:
        """Process a user request through the orchestration pipeline."""
        print(f"\n♾️ Processing request: {request[:100]}...")
        
        # Decompose into tasks
        tasks = self.planner.decompose(request)
        print(f"✓ Decomposed into {len(tasks)} tasks")
        
        # Generate execution plan
        execution_plan = {
            'request': request,
            'timestamp': datetime.utcnow().isoformat(),
            'tasks': [asdict(t) for t in tasks],
            'skills_involved': list(set(t.skill for t in tasks))
        }
        
        # Send to webapp
        self.webapp.send_status_update({
            'type': 'execution_plan',
            'data': execution_plan
        })
        
        return execution_plan
    
    def get_ecosystem_status(self) -> Dict[str, Any]:
        """Get current status of the skill ecosystem."""
        skills_by_capability = {}
        for skill in self.registry.list_all_skills():
            for cap in skill.capabilities:
                if cap not in skills_by_capability:
                    skills_by_capability[cap] = []
                skills_by_capability[cap].append(skill.name)
        
        status = {
            'timestamp': datetime.utcnow().isoformat(),
            'skills': {
                'total': len(self.registry.skills),
                'active': len([s for s in self.registry.skills.values() if s.status == 'active']),
                'by_capability': skills_by_capability
            },
            'webapp_integration': {
                'connected': bool(self.webapp.active_url),
                'url': self.webapp.active_url
            }
        }
        
        return status
    
    def suggest_next_mutation(self) -> Dict[str, Any]:
        """Suggest the next skill to build based on gaps."""
        # Analyze capability coverage
        all_capabilities = set()
        for skill in self.registry.list_all_skills():
            all_capabilities.update(skill.capabilities)
        
        # Common capabilities we want
        desired_capabilities = {
            'blockchain', 'crypto', 'yield', 'portfolio', 'wallet',
            'automation', 'monitoring', 'prediction', 'optimization',
            'memory', 'learning', 'evolution', 'integration'
        }
        
        missing_capabilities = desired_capabilities - all_capabilities
        
        mutation = {
            'timestamp': datetime.utcnow().isoformat(),
            'current_capabilities': list(all_capabilities),
            'missing_capabilities': list(missing_capabilities),
            'recommendation': None
        }
        
        if 'blockchain' in missing_capabilities or 'crypto' in missing_capabilities:
            mutation['recommendation'] = {
                'skill_name': 'cryptohelix',
                'reason': 'Critical gap in blockchain capabilities',
                'priority': 'high'
            }
        elif 'memory' in missing_capabilities or 'learning' in missing_capabilities:
            mutation['recommendation'] = {
                'skill_name': 'empire-memory-cortex',
                'reason': 'Need persistent intelligence layer',
                'priority': 'high'
            }
        
        return mutation

def main():
    """CLI interface for Helix Nexus."""
    import sys
    
    if len(sys.argv) < 2:
        print("Usage:")
        print("  orchestrate.py status")
        print("  orchestrate.py process '<request>'")
        print("  orchestrate.py mutate")
        print("  orchestrate.py webapp <url1> [url2]")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == 'webapp' and len(sys.argv) > 2:
        urls = sys.argv[2:]
        orchestrator = HelixOrchestrator(app_urls=urls)
        print(f"✓ WebApp integration enabled: {urls}")
    else:
        orchestrator = HelixOrchestrator()
    
    if command == 'status':
        status = orchestrator.get_ecosystem_status()
        print(json.dumps(status, indent=2))
    
    elif command == 'process':
        if len(sys.argv) < 3:
            print("Error: No request provided")
            sys.exit(1)
        
        request = sys.argv[2]
        plan = orchestrator.process_request(request)
        print("\n📋 Execution Plan:")
        print(json.dumps(plan, indent=2))
    
    elif command == 'mutate':
        mutation = orchestrator.suggest_next_mutation()
        print("\n🧬 Mutation Recommendation:")
        print(json.dumps(mutation, indent=2))
    
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)

if __name__ == "__main__":
    main()

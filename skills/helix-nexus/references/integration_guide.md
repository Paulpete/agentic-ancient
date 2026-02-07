# Empire Infinity Matrix Integration Guide

Complete guide for integrating Helix Nexus with your webapp infrastructure.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Your WebApp                          │
│  https://echo-null-rift--imfromfuture300.replit.app    │
│  https://ca4ab8cf...spock.replit.dev                   │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP/JSON
                     │ Real-time Status
                     │
┌────────────────────▼────────────────────────────────────┐
│                 Helix Nexus Core                        │
│              (Orchestration Brain)                      │
├─────────────────────────────────────────────────────────┤
│  • Skill Registry & Discovery                           │
│  • Task Decomposition Engine                            │
│  • Execution Planning                                   │
│  • Genetic Algorithm Mutations                          │
│  • WebApp Synchronization                               │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
┌───────▼──────┐         ┌────────▼────────┐
│   Skills     │         │   Skills        │
│   Layer      │         │   Layer         │
├──────────────┤         ├─────────────────┤
│ • docx       │         │ • ralph-ops     │
│ • pdf        │         │ • cryptohelix   │
│ • pptx       │         │ • memory-cortex │
│ • xlsx       │         │ • skill-dna     │
│ • analytics  │         │ • (custom...)   │
└──────────────┘         └─────────────────┘
```

## WebApp API Endpoints

### Expected Endpoints (Auto-detected)

Helix Nexus will attempt these endpoints in order:

1. **POST /api/helix/status** (Recommended)
   - Primary endpoint for all Helix status updates
   - Payload: `HelixStatus` JSON object

2. **POST /api/status** (Fallback)
   - Generic status endpoint

3. **POST /helix/update** (Alternative)
   - Legacy endpoint name

4. **POST /status** (Final fallback)
   - Most generic endpoint

### Status Message Format

```json
{
  "timestamp": "2026-02-05T14:45:00.000Z",
  "type": "heartbeat|task_execution|mutation_proposal|ecosystem_snapshot",
  "data": {
    // Type-specific data
  },
  "source": "helix-nexus"
}
```

### Status Types

#### 1. Heartbeat
Regular system health updates (every 30 seconds recommended).

```json
{
  "type": "heartbeat",
  "data": {
    "health": {
      "status": "online",
      "skills_active": 8,
      "last_mutation": "2026-02-05T14:45:00Z"
    },
    "uptime_hours": 2.5
  }
}
```

#### 2. Task Execution
Log of task completions and results.

```json
{
  "type": "task_execution",
  "data": {
    "task_id": "task_0042",
    "skill": "cryptohelix",
    "result": "Portfolio analysis complete",
    "duration_ms": 1523.4,
    "success": true
  }
}
```

#### 3. Mutation Proposal
Genetic algorithm improvement suggestions.

```json
{
  "type": "mutation_proposal",
  "data": {
    "skill_name": "cryptohelix",
    "mutation_type": "add_typing",
    "expected_improvement": "Better type safety",
    "risk_level": "low",
    "auto_apply": false
  }
}
```

#### 4. Ecosystem Snapshot
Complete skill ecosystem state.

```json
{
  "type": "ecosystem_snapshot",
  "data": {
    "skills": [
      {
        "name": "cryptohelix",
        "status": "active",
        "capabilities": ["blockchain", "yield", "portfolio"],
        "last_used": "2026-02-05T14:30:00Z"
      }
    ],
    "total_count": 12,
    "active_count": 10
  }
}
```

## Integration Patterns

### Pattern 1: Basic Health Monitoring

```python
from webapp_client import EmpireWebAppClient

client = EmpireWebAppClient(
    primary_url="https://echo-null-rift--imfromfuture300.replit.app",
    fallback_url="https://ca4ab8cf...spock.replit.dev"
)

# Send heartbeat every 30 seconds
import time
while True:
    client.send_heartbeat({
        'status': 'online',
        'skills_active': get_active_skill_count()
    })
    time.sleep(30)
```

### Pattern 2: Task Execution Logging

```python
# Before task
task_start = time.time()

# Execute task
result = execute_skill_task(task)

# Log to webapp
duration_ms = (time.time() - task_start) * 1000
client.send_task_execution_log(
    task_id=task.id,
    skill=task.skill,
    result=result,
    duration_ms=duration_ms
)
```

### Pattern 3: Real-time Orchestration

```python
from orchestrate import HelixOrchestrator

orchestrator = HelixOrchestrator(app_urls=[
    "https://echo-null-rift--imfromfuture300.replit.app",
    "https://ca4ab8cf...spock.replit.dev"
])

# Process user request
plan = orchestrator.process_request("Analyze my Solana portfolio")

# Execution plan automatically sent to webapp
# Task logs streamed in real-time
```

## WebApp Dashboard Integration

### Recommended Dashboard Components

1. **Real-time Status Panel**
   - Show current skill ecosystem health
   - Active skills count
   - Last mutation timestamp
   - Connection status to Helix

2. **Task Execution Timeline**
   - Stream of recent task executions
   - Success/failure indicators
   - Duration metrics
   - Skill usage patterns

3. **Mutation Evolution Tracker**
   - Proposed mutations
   - Auto-applied improvements
   - Fitness score trends
   - Generation counter

4. **Skill Ecosystem Map**
   - Visual graph of available skills
   - Capability coverage heatmap
   - Skill interdependencies
   - Usage frequency

### Example Frontend Integration (React)

```javascript
// WebSocket or polling for real-time updates
const [helixStatus, setHelixStatus] = useState(null);

useEffect(() => {
  const interval = setInterval(async () => {
    const response = await fetch('/api/helix/status');
    const status = await response.json();
    setHelixStatus(status);
  }, 5000); // Poll every 5 seconds
  
  return () => clearInterval(interval);
}, []);

// Display in dashboard
<div className="helix-status">
  <h3>🧬 Helix Nexus</h3>
  <div>Skills Active: {helixStatus?.skills_active}</div>
  <div>Status: {helixStatus?.health?.status}</div>
  <div>Last Update: {helixStatus?.timestamp}</div>
</div>
```

## Security Considerations

### Authentication (Future Enhancement)

```python
# Add authentication headers
client = EmpireWebAppClient(
    primary_url="https://...",
    auth_token="your_secret_token"
)
```

### Rate Limiting

Helix Nexus implements client-side rate limiting:
- Heartbeats: Max 1 per 10 seconds
- Task logs: Max 100 per minute
- Mutation proposals: Max 10 per minute

### Data Validation

All outgoing payloads are validated against JSON schema before sending.

## Troubleshooting

### Issue: WebApp Not Receiving Updates

**Solution 1:** Check endpoint availability
```bash
curl -X POST https://your-app.replit.app/api/helix/status \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

**Solution 2:** Check local logs
```bash
cat ~/.helix-nexus/webapp-logs/status_*.jsonl
```

**Solution 3:** Enable debug mode
```bash
HELIX_DEBUG=1 python3 scripts/orchestrate.py status
```

### Issue: Fallback URL Not Working

**Check order:** Helix tries primary first, then fallback.

**Verify both URLs:**
```bash
python3 scripts/webapp_client.py test https://primary-url
python3 scripts/webapp_client.py test https://fallback-url
```

### Issue: High Latency

**Reduce update frequency:**
- Decrease heartbeat rate (default: 30s)
- Batch task logs
- Use local buffering

## Advanced Features

### Custom Status Types

Add your own status types:

```python
client.send_helix_status('custom_metric', {
    'metric_name': 'portfolio_yield',
    'value': 12.5,
    'unit': 'percent_apy'
})
```

### Bidirectional Communication

Fetch commands from webapp:

```python
config = client.fetch_webapp_config()
if config and config.get('mutation_enabled'):
    apply_mutations()
```

### Multi-Instance Coordination

Register multiple Helix instances:

```python
client.register_helix_instance(
    instance_id='helix-prod-01',
    capabilities=['blockchain', 'analytics', 'automation']
)
```

## Production Deployment

### Environment Variables

```bash
HELIX_WEBAPP_PRIMARY=https://echo-null-rift--imfromfuture300.replit.app
HELIX_WEBAPP_FALLBACK=https://ca4ab8cf...spock.replit.dev
HELIX_INSTANCE_ID=prod-01
HELIX_HEARTBEAT_INTERVAL=30
HELIX_DEBUG=0
```

### Systemd Service (Linux)

```ini
[Unit]
Description=Helix Nexus Orchestrator
After=network.target

[Service]
Type=simple
User=cryptogene
Environment="HELIX_WEBAPP_PRIMARY=https://..."
ExecStart=/usr/bin/python3 /opt/helix-nexus/scripts/orchestrate.py daemon
Restart=always

[Install]
WantedBy=multi-user.target
```

### Docker Container

```dockerfile
FROM python:3.11-slim
WORKDIR /helix-nexus
COPY scripts/ ./scripts/
ENV HELIX_WEBAPP_PRIMARY=https://...
CMD ["python3", "scripts/orchestrate.py", "daemon"]
```

## Future Enhancements

- [ ] WebSocket support for true real-time streaming
- [ ] GraphQL API for complex queries
- [ ] Authentication via JWT tokens
- [ ] Encrypted communication (TLS)
- [ ] Skill marketplace integration
- [ ] Multi-tenant support

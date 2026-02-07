#!/usr/bin/env python3
"""
Generate HTML dashboard from Ralph diagnostics data.
"""
import json
import sys
from pathlib import Path
from datetime import datetime
from collections import defaultdict, Counter

def load_diagnostics(session_dir):
    """Load all diagnostic files from a session."""
    session_path = Path(session_dir)
    
    data = {
        'agent_output': [],
        'orchestration': [],
        'performance': [],
        'errors': [],
        'trace': []
    }
    
    for key, filename in [
        ('agent_output', 'agent-output.jsonl'),
        ('orchestration', 'orchestration.jsonl'),
        ('performance', 'performance.jsonl'),
        ('errors', 'errors.jsonl'),
        ('trace', 'trace.jsonl')
    ]:
        file_path = session_path / filename
        if file_path.exists():
            with open(file_path) as f:
                data[key] = [json.loads(line) for line in f if line.strip()]
    
    return data

def analyze_data(data):
    """Extract key metrics and insights."""
    metrics = {
        'total_iterations': 0,
        'total_errors': len(data['errors']),
        'hat_distribution': Counter(),
        'tool_usage': Counter(),
        'backpressure_count': 0,
        'total_tokens_in': 0,
        'total_tokens_out': 0,
        'avg_iteration_ms': 0,
        'termination_reason': None,
        'timeline': []
    }
    
    # Analyze orchestration
    for event in data['orchestration']:
        if event.get('event', {}).get('type') == 'iteration_started':
            metrics['total_iterations'] += 1
        elif event.get('event', {}).get('type') == 'hat_selected':
            hat = event['event'].get('hat', 'unknown')
            metrics['hat_distribution'][hat] += 1
        elif event.get('event', {}).get('type') == 'backpressure_triggered':
            metrics['backpressure_count'] += 1
        elif event.get('event', {}).get('type') == 'loop_terminated':
            metrics['termination_reason'] = event['event'].get('reason', 'unknown')
    
    # Analyze tool usage
    for output in data['agent_output']:
        if output.get('type') == 'tool_call':
            tool_name = output.get('name', 'unknown')
            metrics['tool_usage'][tool_name] += 1
    
    # Analyze performance
    iteration_durations = []
    for perf in data['performance']:
        if perf.get('metric', {}).get('type') == 'token_count':
            metrics['total_tokens_in'] += perf['metric'].get('input', 0)
            metrics['total_tokens_out'] += perf['metric'].get('output', 0)
        elif perf.get('metric', {}).get('type') == 'iteration_duration':
            iteration_durations.append(perf['metric'].get('duration_ms', 0))
    
    if iteration_durations:
        metrics['avg_iteration_ms'] = sum(iteration_durations) / len(iteration_durations)
    
    # Build timeline
    for event in data['orchestration']:
        if 'timestamp' in event or 'ts' in event:
            ts = event.get('timestamp') or event.get('ts')
            event_type = event.get('event', {}).get('type', 'unknown')
            metrics['timeline'].append({
                'timestamp': ts,
                'type': event_type,
                'iteration': event.get('iteration'),
                'details': event.get('event', {})
            })
    
    return metrics

def generate_html(metrics, session_dir):
    """Generate HTML dashboard."""
    session_name = Path(session_dir).name
    
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ralph Analytics - {session_name}</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 2rem;
            color: #2d3748;
        }}
        .container {{
            max-width: 1400px;
            margin: 0 auto;
        }}
        header {{
            background: white;
            border-radius: 12px;
            padding: 2rem;
            margin-bottom: 2rem;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }}
        h1 {{
            font-size: 2rem;
            color: #667eea;
            margin-bottom: 0.5rem;
        }}
        .session-info {{
            color: #718096;
            font-size: 0.9rem;
        }}
        .grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }}
        .card {{
            background: white;
            border-radius: 12px;
            padding: 1.5rem;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }}
        .card h2 {{
            font-size: 1.25rem;
            margin-bottom: 1rem;
            color: #4a5568;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 0.5rem;
        }}
        .metric {{
            display: flex;
            justify-content: space-between;
            padding: 0.75rem 0;
            border-bottom: 1px solid #f7fafc;
        }}
        .metric:last-child {{
            border-bottom: none;
        }}
        .metric-label {{
            color: #718096;
            font-weight: 500;
        }}
        .metric-value {{
            font-weight: 600;
            color: #2d3748;
        }}
        .metric-value.good {{ color: #48bb78; }}
        .metric-value.warning {{ color: #ed8936; }}
        .metric-value.error {{ color: #f56565; }}
        .bar-chart {{
            margin-top: 1rem;
        }}
        .bar-item {{
            margin-bottom: 0.5rem;
        }}
        .bar-label {{
            display: flex;
            justify-content: space-between;
            margin-bottom: 0.25rem;
            font-size: 0.875rem;
        }}
        .bar-bg {{
            background: #e2e8f0;
            border-radius: 4px;
            height: 24px;
            overflow: hidden;
        }}
        .bar-fill {{
            background: linear-gradient(90deg, #667eea, #764ba2);
            height: 100%;
            transition: width 0.3s ease;
            display: flex;
            align-items: center;
            padding: 0 0.5rem;
            color: white;
            font-size: 0.75rem;
            font-weight: 600;
        }}
        .timeline {{
            max-height: 400px;
            overflow-y: auto;
        }}
        .timeline-item {{
            padding: 0.75rem;
            border-left: 3px solid #667eea;
            margin-left: 1rem;
            margin-bottom: 0.5rem;
            background: #f7fafc;
            border-radius: 0 4px 4px 0;
        }}
        .timeline-time {{
            font-size: 0.75rem;
            color: #718096;
            margin-bottom: 0.25rem;
        }}
        .timeline-event {{
            font-weight: 600;
            color: #2d3748;
        }}
        .status-badge {{
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 12px;
            font-size: 0.875rem;
            font-weight: 600;
        }}
        .status-badge.success {{ background: #c6f6d5; color: #22543d; }}
        .status-badge.warning {{ background: #feebc8; color: #7c2d12; }}
        .status-badge.error {{ background: #fed7d7; color: #742a2a; }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🔍 Ralph Analytics Dashboard</h1>
            <div class="session-info">Session: {session_name} | Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</div>
        </header>
        
        <div class="grid">
            <div class="card">
                <h2>📊 Overview</h2>
                <div class="metric">
                    <span class="metric-label">Total Iterations</span>
                    <span class="metric-value">{metrics['total_iterations']}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Errors</span>
                    <span class="metric-value {'error' if metrics['total_errors'] > 0 else 'good'}">{metrics['total_errors']}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Backpressure Events</span>
                    <span class="metric-value {'warning' if metrics['backpressure_count'] > 3 else ''}">{metrics['backpressure_count']}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Termination</span>
                    <span class="metric-value">{metrics['termination_reason'] or 'Running'}</span>
                </div>
            </div>
            
            <div class="card">
                <h2>⚡ Performance</h2>
                <div class="metric">
                    <span class="metric-label">Avg Iteration Time</span>
                    <span class="metric-value">{metrics['avg_iteration_ms']:.0f}ms</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Total Input Tokens</span>
                    <span class="metric-value">{metrics['total_tokens_in']:,}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Total Output Tokens</span>
                    <span class="metric-value">{metrics['total_tokens_out']:,}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Token Efficiency</span>
                    <span class="metric-value">{(metrics['total_tokens_out'] / max(metrics['total_tokens_in'], 1)):.2f}x</span>
                </div>
            </div>
        </div>
        
        <div class="grid">
            <div class="card">
                <h2>🎩 Hat Distribution</h2>
                <div class="bar-chart">
"""
    
    # Hat distribution bars
    if metrics['hat_distribution']:
        max_count = max(metrics['hat_distribution'].values())
        for hat, count in metrics['hat_distribution'].most_common():
            percentage = (count / max_count) * 100
            html += f"""
                    <div class="bar-item">
                        <div class="bar-label">
                            <span>{hat}</span>
                            <span>{count}</span>
                        </div>
                        <div class="bar-bg">
                            <div class="bar-fill" style="width: {percentage}%">{count}</div>
                        </div>
                    </div>
"""
    else:
        html += "<p style='color: #718096;'>No hat data available</p>"
    
    html += """
                </div>
            </div>
            
            <div class="card">
                <h2>🛠️ Tool Usage</h2>
                <div class="bar-chart">
"""
    
    # Tool usage bars
    if metrics['tool_usage']:
        max_count = max(metrics['tool_usage'].values())
        for tool, count in metrics['tool_usage'].most_common(10):
            percentage = (count / max_count) * 100
            html += f"""
                    <div class="bar-item">
                        <div class="bar-label">
                            <span>{tool}</span>
                            <span>{count}</span>
                        </div>
                        <div class="bar-bg">
                            <div class="bar-fill" style="width: {percentage}%">{count}</div>
                        </div>
                    </div>
"""
    else:
        html += "<p style='color: #718096;'>No tool usage data available</p>"
    
    html += """
                </div>
            </div>
        </div>
        
        <div class="card">
            <h2>📅 Event Timeline</h2>
            <div class="timeline">
"""
    
    # Timeline
    if metrics['timeline']:
        for event in metrics['timeline'][-20:]:  # Last 20 events
            event_type = event['type']
            badge_class = 'success' if 'completed' in event_type else ('error' if 'error' in event_type or 'failed' in event_type else 'warning')
            html += f"""
                <div class="timeline-item">
                    <div class="timeline-time">{event['timestamp']}</div>
                    <div class="timeline-event">
                        <span class="status-badge {badge_class}">{event_type}</span>
                        {f"(Iteration {event['iteration']})" if event.get('iteration') else ''}
                    </div>
                </div>
"""
    else:
        html += "<p style='color: #718096;'>No timeline data available</p>"
    
    html += """
            </div>
        </div>
    </div>
</body>
</html>
"""
    
    return html

def main():
    if len(sys.argv) < 2:
        print("Usage: generate_dashboard.py <session-directory> [output.html]")
        sys.exit(1)
    
    session_dir = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else "ralph-dashboard.html"
    
    print(f"Loading diagnostics from {session_dir}...")
    data = load_diagnostics(session_dir)
    
    print("Analyzing data...")
    metrics = analyze_data(data)
    
    print("Generating dashboard...")
    html = generate_html(metrics, session_dir)
    
    with open(output_file, 'w') as f:
        f.write(html)
    
    print(f"✅ Dashboard generated: {output_file}")
    print(f"   Iterations: {metrics['total_iterations']}")
    print(f"   Errors: {metrics['total_errors']}")
    print(f"   Tools used: {len(metrics['tool_usage'])}")

if __name__ == "__main__":
    main()

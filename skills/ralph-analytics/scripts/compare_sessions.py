#!/usr/bin/env python3
"""
Compare multiple Ralph diagnostic sessions.
"""
import json
import sys
from pathlib import Path
from collections import Counter

def load_session_metrics(session_dir):
    """Extract key metrics from a session."""
    session_path = Path(session_dir)
    
    metrics = {
        'name': session_path.name,
        'iterations': 0,
        'errors': 0,
        'backpressure': 0,
        'tools_used': Counter(),
        'hats_used': Counter(),
        'total_tokens': 0,
        'avg_iteration_ms': 0
    }
    
    # Load orchestration
    orch_file = session_path / 'orchestration.jsonl'
    if orch_file.exists():
        with open(orch_file) as f:
            for line in f:
                if not line.strip():
                    continue
                event = json.loads(line)
                event_type = event.get('event', {}).get('type')
                
                if event_type == 'iteration_started':
                    metrics['iterations'] += 1
                elif event_type == 'hat_selected':
                    hat = event['event'].get('hat', 'unknown')
                    metrics['hats_used'][hat] += 1
                elif event_type == 'backpressure_triggered':
                    metrics['backpressure'] += 1
    
    # Load agent output
    agent_file = session_path / 'agent-output.jsonl'
    if agent_file.exists():
        with open(agent_file) as f:
            for line in f:
                if not line.strip():
                    continue
                output = json.loads(line)
                if output.get('type') == 'tool_call':
                    tool = output.get('name', 'unknown')
                    metrics['tools_used'][tool] += 1
    
    # Load errors
    error_file = session_path / 'errors.jsonl'
    if error_file.exists():
        with open(error_file) as f:
            metrics['errors'] = sum(1 for line in f if line.strip())
    
    # Load performance
    perf_file = session_path / 'performance.jsonl'
    if perf_file.exists():
        durations = []
        with open(perf_file) as f:
            for line in f:
                if not line.strip():
                    continue
                perf = json.loads(line)
                if perf.get('metric', {}).get('type') == 'token_count':
                    metrics['total_tokens'] += perf['metric'].get('input', 0)
                    metrics['total_tokens'] += perf['metric'].get('output', 0)
                elif perf.get('metric', {}).get('type') == 'iteration_duration':
                    durations.append(perf['metric'].get('duration_ms', 0))
        
        if durations:
            metrics['avg_iteration_ms'] = sum(durations) / len(durations)
    
    return metrics

def compare_sessions(session_dirs):
    """Compare multiple sessions."""
    sessions = [load_session_metrics(d) for d in session_dirs]
    
    print("=" * 80)
    print("RALPH SESSION COMPARISON")
    print("=" * 80)
    
    # Overview table
    print("\n📊 OVERVIEW")
    print("-" * 80)
    print(f"{'Session':<30} {'Iterations':>12} {'Errors':>8} {'Backpressure':>14} {'Tokens':>12}")
    print("-" * 80)
    
    for s in sessions:
        print(f"{s['name']:<30} {s['iterations']:>12} {s['errors']:>8} {s['backpressure']:>14} {s['total_tokens']:>12,}")
    
    # Performance comparison
    print("\n⚡ PERFORMANCE")
    print("-" * 80)
    print(f"{'Session':<30} {'Avg Iteration':>15} {'Tokens/Iteration':>18}")
    print("-" * 80)
    
    for s in sessions:
        tokens_per_iter = s['total_tokens'] / max(s['iterations'], 1)
        print(f"{s['name']:<30} {s['avg_iteration_ms']:>13.0f}ms {tokens_per_iter:>18,.0f}")
    
    # Tool usage
    print("\n🛠️  TOOL USAGE")
    print("-" * 80)
    
    all_tools = set()
    for s in sessions:
        all_tools.update(s['tools_used'].keys())
    
    for tool in sorted(all_tools):
        counts = [str(s['tools_used'].get(tool, 0)) for s in sessions]
        session_names = [s['name'][:20] for s in sessions]
        print(f"{tool:<20} " + " | ".join(f"{name:>20}: {count:>4}" for name, count in zip(session_names, counts)))
    
    # Hat distribution
    print("\n🎩 HAT DISTRIBUTION")
    print("-" * 80)
    
    all_hats = set()
    for s in sessions:
        all_hats.update(s['hats_used'].keys())
    
    for hat in sorted(all_hats):
        counts = [s['hats_used'].get(hat, 0) for s in sessions]
        percentages = [f"{(c/max(s['iterations'],1)*100):.1f}%" for c, s in zip(counts, sessions)]
        session_names = [s['name'][:20] for s in sessions]
        print(f"{hat:<20} " + " | ".join(f"{name:>20}: {pct:>6}" for name, pct in zip(session_names, percentages)))
    
    # Insights
    print("\n💡 INSIGHTS")
    print("-" * 80)
    
    # Find session with most errors
    max_errors_session = max(sessions, key=lambda s: s['errors'])
    if max_errors_session['errors'] > 0:
        print(f"⚠️  Most errors: {max_errors_session['name']} ({max_errors_session['errors']} errors)")
    
    # Find fastest session
    sessions_with_time = [s for s in sessions if s['avg_iteration_ms'] > 0]
    if sessions_with_time:
        fastest = min(sessions_with_time, key=lambda s: s['avg_iteration_ms'])
        slowest = max(sessions_with_time, key=lambda s: s['avg_iteration_ms'])
        print(f"🏃 Fastest: {fastest['name']} ({fastest['avg_iteration_ms']:.0f}ms/iter)")
        print(f"🐌 Slowest: {slowest['name']} ({slowest['avg_iteration_ms']:.0f}ms/iter)")
    
    # Find most efficient (fewest tokens per iteration)
    sessions_with_tokens = [s for s in sessions if s['iterations'] > 0]
    if sessions_with_tokens:
        most_efficient = min(sessions_with_tokens, key=lambda s: s['total_tokens']/s['iterations'])
        least_efficient = max(sessions_with_tokens, key=lambda s: s['total_tokens']/s['iterations'])
        print(f"💰 Most efficient: {most_efficient['name']} ({most_efficient['total_tokens']/most_efficient['iterations']:.0f} tokens/iter)")
        print(f"💸 Least efficient: {least_efficient['name']} ({least_efficient['total_tokens']/least_efficient['iterations']:.0f} tokens/iter)")

def main():
    if len(sys.argv) < 3:
        print("Usage: compare_sessions.py <session1> <session2> [session3...]")
        sys.exit(1)
    
    session_dirs = sys.argv[1:]
    
    # Validate all directories exist
    for d in session_dirs:
        if not Path(d).exists():
            print(f"Error: Directory not found: {d}")
            sys.exit(1)
    
    compare_sessions(session_dirs)

if __name__ == "__main__":
    main()

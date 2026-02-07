#!/usr/bin/env python3
"""
Detect anomalies and potential issues in Ralph diagnostics.
"""
import json
import sys
from pathlib import Path
from collections import Counter, defaultdict

def load_jsonl(filepath):
    """Load JSONL file."""
    if not filepath.exists():
        return []
    with open(filepath) as f:
        return [json.loads(line) for line in f if line.strip()]

class AnomalyDetector:
    def __init__(self, session_dir):
        self.session_path = Path(session_dir)
        self.anomalies = []
        
    def detect_all(self):
        """Run all anomaly detection checks."""
        self.check_stuck_loops()
        self.check_excessive_backpressure()
        self.check_tool_spam()
        self.check_error_patterns()
        self.check_performance_degradation()
        return self.anomalies
    
    def add_anomaly(self, severity, category, message, details=None):
        """Add an anomaly to the list."""
        self.anomalies.append({
            'severity': severity,  # 'critical', 'warning', 'info'
            'category': category,
            'message': message,
            'details': details or {}
        })
    
    def check_stuck_loops(self):
        """Detect loops making no progress."""
        orchestration = load_jsonl(self.session_path / 'orchestration.jsonl')
        agent_output = load_jsonl(self.session_path / 'agent-output.jsonl')
        
        # Group by iteration
        iterations = defaultdict(lambda: {'events': 0, 'tools': 0})
        for event in orchestration:
            iteration = event.get('iteration')
            if iteration:
                iterations[iteration]['events'] += 1
        
        for output in agent_output:
            iteration = output.get('iteration')
            if iteration and output.get('type') == 'tool_call':
                iterations[iteration]['tools'] += 1
        
        # Find iterations with many events but few tools
        for iteration, stats in iterations.items():
            if stats['events'] > 10 and stats['tools'] < 2:
                self.add_anomaly(
                    'warning',
                    'stuck_loop',
                    f'Iteration {iteration} has many events ({stats["events"]}) but few tool calls ({stats["tools"]})',
                    {'iteration': iteration, 'events': stats['events'], 'tools': stats['tools']}
                )
    
    def check_excessive_backpressure(self):
        """Detect too many backpressure events."""
        orchestration = load_jsonl(self.session_path / 'orchestration.jsonl')
        
        backpressure_events = [
            e for e in orchestration 
            if e.get('event', {}).get('type') == 'backpressure_triggered'
        ]
        
        if len(backpressure_events) > 5:
            reasons = Counter(e['event'].get('reason', 'unknown') for e in backpressure_events)
            self.add_anomaly(
                'warning',
                'excessive_backpressure',
                f'High backpressure count: {len(backpressure_events)} events',
                {'count': len(backpressure_events), 'reasons': dict(reasons)}
            )
    
    def check_tool_spam(self):
        """Detect repetitive tool calls."""
        agent_output = load_jsonl(self.session_path / 'agent-output.jsonl')
        
        # Look for same tool called many times in sequence
        tool_sequence = [
            o.get('name') for o in agent_output 
            if o.get('type') == 'tool_call'
        ]
        
        # Count consecutive tool calls
        if tool_sequence:
            current_tool = tool_sequence[0]
            consecutive_count = 1
            max_consecutive = 1
            max_tool = current_tool
            
            for tool in tool_sequence[1:]:
                if tool == current_tool:
                    consecutive_count += 1
                    if consecutive_count > max_consecutive:
                        max_consecutive = consecutive_count
                        max_tool = tool
                else:
                    current_tool = tool
                    consecutive_count = 1
            
            if max_consecutive > 10:
                self.add_anomaly(
                    'warning',
                    'tool_spam',
                    f'Tool "{max_tool}" called {max_consecutive} times consecutively',
                    {'tool': max_tool, 'consecutive_calls': max_consecutive}
                )
    
    def check_error_patterns(self):
        """Detect error patterns."""
        errors = load_jsonl(self.session_path / 'errors.jsonl')
        
        # Filter out non-dict entries (like empty arrays)
        errors = [e for e in errors if isinstance(e, dict)]
        
        if not errors:
            return
        
        error_types = Counter(e.get('error_type', 'unknown') for e in errors)
        
        for error_type, count in error_types.items():
            severity = 'critical' if count > 3 else 'warning'
            self.add_anomaly(
                severity,
                'repeated_errors',
                f'{error_type} occurred {count} times',
                {'error_type': error_type, 'count': count}
            )
    
    def check_performance_degradation(self):
        """Detect performance issues."""
        performance = load_jsonl(self.session_path / 'performance.jsonl')
        
        # Extract iteration durations
        durations = [
            (p.get('iteration'), p['metric'].get('duration_ms'))
            for p in performance
            if p.get('metric', {}).get('type') == 'iteration_duration'
        ]
        
        if len(durations) < 3:
            return
        
        # Check if durations are increasing (potential memory leak or degradation)
        early_avg = sum(d[1] for d in durations[:3]) / 3
        late_avg = sum(d[1] for d in durations[-3:]) / 3
        
        if late_avg > early_avg * 2:  # 2x slower
            self.add_anomaly(
                'warning',
                'performance_degradation',
                f'Performance degraded: early iterations {early_avg:.0f}ms → late iterations {late_avg:.0f}ms',
                {'early_avg_ms': early_avg, 'late_avg_ms': late_avg, 'degradation_factor': late_avg / early_avg}
            )

def main():
    if len(sys.argv) < 2:
        print("Usage: detect_anomalies.py <session-directory>")
        sys.exit(1)
    
    session_dir = sys.argv[1]
    
    print(f"🔍 Analyzing {session_dir} for anomalies...\n")
    
    detector = AnomalyDetector(session_dir)
    anomalies = detector.detect_all()
    
    if not anomalies:
        print("✅ No anomalies detected!")
        return
    
    # Group by severity
    by_severity = defaultdict(list)
    for anomaly in anomalies:
        by_severity[anomaly['severity']].append(anomaly)
    
    # Print results
    severity_order = ['critical', 'warning', 'info']
    severity_icons = {'critical': '🔴', 'warning': '⚠️', 'info': 'ℹ️'}
    
    for severity in severity_order:
        if severity in by_severity:
            print(f"\n{severity_icons[severity]} {severity.upper()} ({len(by_severity[severity])})")
            print("=" * 60)
            for anomaly in by_severity[severity]:
                print(f"\n{anomaly['category']}: {anomaly['message']}")
                if anomaly['details']:
                    for key, value in anomaly['details'].items():
                        print(f"  {key}: {value}")
    
    print(f"\n\n📊 Summary: {len(anomalies)} anomalies detected")
    print(f"   Critical: {len(by_severity.get('critical', []))}")
    print(f"   Warnings: {len(by_severity.get('warning', []))}")
    print(f"   Info: {len(by_severity.get('info', []))}")

if __name__ == "__main__":
    main()

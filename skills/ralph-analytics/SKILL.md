---
name: ralph-analytics
description: Advanced analytics and insights for Ralph orchestration diagnostics. Use when analyzing Ralph loop performance, detecting anomalies, comparing sessions, generating visual dashboards, investigating backpressure issues, debugging stuck loops, or performing post-mortem analysis on Ralph diagnostic data. Triggers include requests to "analyze Ralph diagnostics", "generate dashboard", "compare sessions", "find anomalies", "visualize Ralph data", or working with .ralph/diagnostics/ directories.
---

# Ralph Analytics

Transform Ralph diagnostic data into actionable insights with visual dashboards, anomaly detection, and comparative analysis.

## Overview

Ralph generates detailed diagnostic data in `.ralph/diagnostics/<session>/` containing:
- `agent-output.jsonl` - Agent responses and tool calls
- `orchestration.jsonl` - Hat selection and orchestration events
- `performance.jsonl` - Timing and token metrics
- `errors.jsonl` - Errors and failures
- `trace.jsonl` - Detailed trace logs

This skill provides three powerful analysis approaches:

1. **Visual Dashboard** - Beautiful HTML dashboard with charts and metrics
2. **Anomaly Detection** - Smart detection of stuck loops, performance issues, and errors
3. **Session Comparison** - Side-by-side analysis of multiple sessions

## Quick Start

### Generate Dashboard
```bash
scripts/generate_dashboard.py <session-dir> [output.html]
```

Creates an interactive HTML dashboard showing:
- Iteration count, errors, backpressure events
- Performance metrics (timing, tokens, efficiency)
- Hat distribution chart
- Tool usage breakdown
- Event timeline

**Example:**
```bash
SESSION=$(ls -t .ralph/diagnostics/ | head -1)
scripts/generate_dashboard.py ".ralph/diagnostics/$SESSION" dashboard.html
```

### Detect Anomalies
```bash
scripts/detect_anomalies.py <session-dir>
```

Automatically detects:
- **Stuck loops** - Many events but few tool calls
- **Excessive backpressure** - High backpressure event count
- **Tool spam** - Same tool called repeatedly
- **Error patterns** - Repeated error types
- **Performance degradation** - Iterations getting slower over time

Output shows severity (critical/warning/info) and actionable details.

### Compare Sessions
```bash
scripts/compare_sessions.py <session1> <session2> [session3...]
```

Generates comparison tables showing:
- Iteration counts and error rates
- Performance metrics (avg iteration time, tokens/iteration)
- Tool usage across sessions
- Hat distribution percentages
- Insights (fastest/slowest, most/least efficient)

## Workflow Patterns

### Post-Mortem Analysis
When investigating a completed or failed loop:

1. Generate dashboard for visual overview
2. Run anomaly detection to identify issues
3. Check references/quick_patterns.md for targeted jq queries
4. Drill into specific iterations or events as needed

**Example:**
```bash
SESSION=".ralph/diagnostics/2025-02-05T14-30-52"
scripts/generate_dashboard.py "$SESSION" report.html
scripts/detect_anomalies.py "$SESSION"
```

### Performance Optimization
When optimizing loop performance:

1. Run multiple test sessions with different configurations
2. Compare sessions to identify performance differences
3. Use anomaly detection to find bottlenecks
4. Analyze hat distribution and tool usage patterns

**Example:**
```bash
scripts/compare_sessions.py \
  .ralph/diagnostics/baseline \
  .ralph/diagnostics/optimized-v1 \
  .ralph/diagnostics/optimized-v2
```

### Real-time Monitoring
When monitoring an active loop:

1. Generate dashboard periodically to track progress
2. Watch for anomaly alerts
3. Use jq patterns for live event tracking

**Example:**
```bash
# Monitor latest session every 30 seconds
watch -n 30 'SESSION=$(ls -t .ralph/diagnostics/ | head -1); scripts/detect_anomalies.py .ralph/diagnostics/$SESSION'
```

## Advanced Analysis

For complex investigations, see **references/quick_patterns.md** which provides:
- jq patterns for finding problem areas
- Pattern detection queries (stuck loops, error clustering)
- Performance analysis (token usage, timing trends)
- Timeline analysis and cross-file correlation

Common advanced queries:

**Find iterations with excessive tool calls:**
```bash
jq -s '[.[] | select(.type == "tool_call")] | group_by(.iteration) | map({iter: .[0].iteration, tools: length}) | sort_by(-.tools) | .[0:5]' agent-output.jsonl
```

**Identify performance outliers:**
```bash
jq 'select(.metric.type == "iteration_duration") | {iter: .iteration, ms: .metric.duration_ms}' performance.jsonl | awk '{print $NF}' | sort -n | awk '{arr[NR]=$1} END {print "Median:", arr[int(NR/2)], "95th:", arr[int(NR*0.95)]}'
```

## Output Files

Scripts generate the following:
- **HTML dashboards** - Open in browser, fully self-contained
- **Console output** - Formatted tables and alerts with color coding
- **JSON data** - Can pipe to other tools for further analysis

## Troubleshooting

**No data in dashboard:** Check that session directory contains .jsonl files. Some data may be missing if diagnostics weren't enabled with `RALPH_DIAGNOSTICS=1`.

**Anomaly detection shows no issues:** Good news! Session completed without detected problems.

**Compare sessions fails:** Ensure all session directories exist and contain diagnostic files.

## Resources

- **scripts/generate_dashboard.py** - HTML dashboard generator with charts
- **scripts/detect_anomalies.py** - Smart anomaly detection engine
- **scripts/compare_sessions.py** - Multi-session comparison tool
- **references/quick_patterns.md** - jq pattern library for advanced analysis

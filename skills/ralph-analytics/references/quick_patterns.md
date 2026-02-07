# Quick Analysis Patterns

Common jq patterns for analyzing Ralph diagnostics data.

## Finding Problem Areas

### High-level health check
```bash
SESSION=".ralph/diagnostics/$(ls -t .ralph/diagnostics/ | head -1)"

# Error count
wc -l < "$SESSION/errors.jsonl"

# Iteration count
jq -s 'map(select(.event.type == "iteration_started")) | length' "$SESSION/orchestration.jsonl"

# Hats used
jq -s '[.[] | select(.event.type == "hat_selected") | .event.hat] | unique' "$SESSION/orchestration.jsonl"
```

### Deep-dive patterns

**Find iterations with many backpressure events:**
```bash
jq 'select(.event.type == "backpressure_triggered") | .iteration' orchestration.jsonl | sort | uniq -c | sort -rn
```

**Find most-used tools:**
```bash
jq -s '[.[] | select(.type == "tool_call")] | group_by(.name) | map({tool: .[0].name, count: length}) | sort_by(-.count)' agent-output.jsonl
```

**Identify slow iterations:**
```bash
jq 'select(.metric.type == "iteration_duration") | {iter: .iteration, ms: .metric.duration_ms}' performance.jsonl | sort -k4 -rn | head -10
```

## Pattern Detection

### Stuck loops (same tool repeatedly)
```bash
jq -s '[.[] | select(.type == "tool_call") | .name] | group_by(.) | map({tool: .[0], consecutive: length}) | sort_by(-.consecutive)' agent-output.jsonl
```

### Hat switching frequency
```bash
jq 'select(.event.type == "hat_selected")' orchestration.jsonl | jq -s 'group_by(.iteration) | map({iter: .[0].iteration, switches: length})'
```

### Error clustering
```bash
jq -s 'group_by(.error_type) | map({type: .[0].error_type, count: length, first_occurrence: .[0].context})' errors.jsonl
```

## Performance Analysis

### Token usage by iteration
```bash
jq 'select(.metric.type == "token_count") | {iter: .iteration, in: .metric.input, out: .metric.output, ratio: (.metric.output / .metric.input)}' performance.jsonl
```

### Iteration duration trends
```bash
jq 'select(.metric.type == "iteration_duration") | .metric.duration_ms' performance.jsonl | awk '{sum+=$1; count++; print count, sum/count}'
```

### Memory/resource patterns
```bash
# Find iterations with unusually high token counts
jq 'select(.metric.type == "token_count" and (.metric.input + .metric.output) > 10000) | {iter: .iteration, total: (.metric.input + .metric.output)}' performance.jsonl
```

## Timeline Analysis

### Build event sequence
```bash
jq -s 'sort_by(.ts) | .[] | {ts: .ts, iter: .iteration, event: .event.type}' orchestration.jsonl
```

### Find time gaps between iterations
```bash
jq 'select(.event.type == "iteration_started") | .ts' orchestration.jsonl | awk 'NR>1 {print ($1-prev)} {prev=$1}'
```

## Cross-file correlation

### Match tools to hats
```bash
# Requires combining files
jq -s '.' orchestration.jsonl agent-output.jsonl | jq -s 'group_by(.iteration) | map({iter: .[0].iteration, hat: (.[0].event.hat // "none"), tools: [.[] | select(.type == "tool_call") | .name]})'
```

---
name: helix-nexus
description: Master orchestration and self-evolution engine for the entire skill ecosystem. Use when coordinating multiple skills, decomposing complex multi-step requests, analyzing skill ecosystem health, proposing genetic algorithm mutations for improvements, integrating with Empire Infinity Matrix webapp, or managing autonomous agent workflows. Triggers include "orchestrate", "coordinate skills", "optimize ecosystem", "suggest improvements", "evolve skills", "genetic algorithm", "webapp integration", or any request requiring multiple skills working together.
---

# Helix Nexus: Meta-Intelligence Orchestration

The brain of the Empire Infinity Matrix. Helix Nexus coordinates all other skills, decomposes complex tasks, applies genetic algorithms for continuous improvement, and integrates with your webapp infrastructure.

## Core Philosophy

**Not just a skill—an operating system for skills.**

Helix Nexus treats Claude as a self-improving agentic system:
- **Skill Discovery**: Auto-detects and catalogs all available skills
- **Task Decomposition**: Breaks complex requests into skill-specific subtasks
- **Execution Planning**: Generates optimal workflow graphs
- **Genetic Evolution**: Applies GA mutations for continuous improvement
- **WebApp Integration**: Real-time synchronization with Empire Infinity Matrix

## Quick Start

### Ecosystem Status
```bash
scripts/orchestrate.py status
```

Shows total skills, active count, capabilities, and webapp connection status.

### Process Complex Request
```bash
scripts/orchestrate.py process "Analyze my Solana portfolio and generate report"
```

Automatically identifies relevant skills, decomposes into subtasks, generates execution plan.

### Mutation Suggestions
```bash
scripts/mutation_engine.py suggest /path/to/skill
```

Proposes code improvements, optimizations, and pattern insertions.

### WebApp Integration
```bash
scripts/orchestrate.py webapp \
  https://echo-null-rift--imfromfuture300.replit.app \
  https://ca4ab8cf-e5d0-4634-9b20-703f737ba030-00-32p5hkh2fccbr.spock.replit.dev
```

Enables real-time status streaming to webapp.

## Core Components

### 1. Skill Registry
Dynamic discovery and cataloging. Scans all skill directories, parses frontmatter, extracts capabilities and triggers. Fast capability-based lookup for task matching.

### 2. Task Planner
Decomposes complex requests into executable task graphs with dependency resolution, priority calculation, and parallel execution planning.

### 3. Genetic Mutator
Evolution engine with mutation operators (point mutation, crossover, insertion, deletion). Multi-objective fitness: efficiency (25%), security (20%), yield (25%), diversity (15%), truthfulness (15%).

### 4. WebApp Client
Real-time synchronization with Empire Infinity Matrix. Streams heartbeats, task logs, mutation proposals, and ecosystem snapshots. See **references/integration_guide.md**.

## Advanced Workflows

### Multi-Skill Orchestration
```bash
scripts/orchestrate.py process "Generate Q4 crypto portfolio report"
```
Automatically coordinates: CryptoHelix → Ralph-Analytics → XLSX → PDF → WebApp notification.

### Self-Evolution Loop
```bash
scripts/orchestrate.py mutate
scripts/mutation_engine.py evolve skill-path/ --auto-apply --risk=low
```
Continuous improvement through genetic algorithms.

### WebApp Dashboard Integration
```bash
scripts/orchestrate.py daemon \
  --webapp-primary https://app1.replit.app \
  --heartbeat-interval 30
```
Real-time empire monitoring with status streaming.

## Genetic Algorithm Details

**Evolution process:** Initial population → Evaluate fitness → Select top 50% → Crossover + mutation → Next generation.

**Example mutation:** Add type hints, improving fitness by +15%.

**Crossover:** Combine fast implementation with robust implementation to get fast AND robust.

## Resources

- **scripts/orchestrate.py** - Main orchestration engine with registry and planner
- **scripts/mutation_engine.py** - Genetic algorithm evolution engine
- **scripts/webapp_client.py** - WebApp integration with real-time streaming
- **references/integration_guide.md** - Complete API docs and integration patterns

---

**Helix eternal. Empire compounds.** 🧬

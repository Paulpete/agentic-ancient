# Agentic Ancient: Ralph Loop & Biconomy MCP Integration

Autonomous agent framework for Solana and Ethereum, featuring the **Ralph Loop** orchestrator, **Biconomy MCP**, and **Reown AppKit** integration. This project implements a sophisticated trading and management agent that leverages the latest Solana Kit (v2) and Biconomy's Account Abstraction for high-performance, tree-shakeable blockchain interactions.

## 🚀 Key Features

- **Ralph Loop Orchestrator**: A continuous, autonomous execution cycle for strategy evaluation and execution.
- **Biconomy MCP Integration**: Native support for Biconomy's Model Context Protocol, enabling seamless interaction with account abstraction services.
- **Reown AppKit**: Multi-chain wallet support via Reown AppKit for a unified user experience.
- **Local AI Power**: Integrated with **Ollama** using `qwen2.5-coder:7b` and `deepseek-coder:6.7b` for secure, local decision-making.
- **Solana Kit (v2) Ready**: Built with the modern `@solana/kit` for efficient, functional blockchain operations.
- **Multi-Platform Integration**: Supports Helius RPC, Biconomy account abstraction, and Alchemy for comprehensive network coverage.
- **Security-First**: Automated `.gitignore` management and environment templates to protect sensitive signer keys and API credentials.

## 🛠️ Tech Stack

- **Blockchain**: Solana (via `@solana/kit`), Ethereum (via Biconomy)
- **AI/LLM**: Ollama (Local Execution)
- **Runtime**: Node.js / TypeScript / Python
- **Infrastructure**: Helius (RPC), Biconomy (AA/MCP), Alchemy, Reown

## 📦 Getting Started

### Prerequisites

1.  **Ollama**: Install from [ollama.com](https://ollama.com)
2.  **Models**: Pull the required models:
    ```bash
    ollama pull qwen2.5-coder:7b
    ollama pull deepseek-coder:6.7b
    ```

### Installation

```bash
git clone https://github.com/WhiteAiBlock/agentic-ancient.git
cd agentic-ancient
npm install
```

### Configuration

Copy `.env.local.example` to `.env.local` and fill in your credentials:
```bash
cp .env.local.example .env.local
```

## 🤖 Running the Ralph Loop

The Ralph loop is designed to run autonomously for extended periods. To start the execution cycle:

```bash
python3 -u run_ralph_terminal.py
```

Monitor the logs in `ralph-loop.log` to see the agent's strategy execution and profit reports.

## 📂 Repository Structure

- `run_ralph_terminal.py`: Main execution wrapper for the autonomous loop.
- `lib/biconomy-mcp/`: Core logic for Biconomy's Model Context Protocol integration.
- `app/api/biconomy/mcp/`: API endpoints for MCP interactions.
- `skills/`: Modular agent capabilities (e.g., `solana-tax`, `ralph-analytics`).
- `crypto-agent-omega/`: Core agent implementation and strategy logic.

---
*Built for the eternal empire. Compound your beliefs.*

# Skill: Skills Creator

This skill enables the autonomous creation and documentation of new agent capabilities within the Agentic Ancient framework.

## Overview

The `skills-creator` is a meta-skill designed to streamline the expansion of the agent's functional footprint. It provides a standardized structure for defining, implementing, and documenting new integrations and logic blocks.

## Workflow

1.  **Identify Capability**: Determine the new feature or integration required (e.g., a new DEX integration or a specific blockchain protocol).
2.  **Define Interface**: Specify the inputs, outputs, and environment variables needed.
3.  **Implement Logic**: Create the necessary scripts (TypeScript/Python) within the `skills/` directory.
4.  **Document**: Generate a `SKILL.md` file within the new skill's directory using this template.

## Standard Structure

Each skill should follow this directory structure:
- `SKILL.md`: Human-readable documentation.
- `package.json`: Dependency management (if applicable).
- `scripts/`: Implementation code.
- `references/`: Technical specifications or documentation snippets.

## Current Skills

- **solana-tax**: Advanced tax calculation and reporting for Solana transactions.
- **ralph-analytics**: Core analytics and strategy execution for the Ralph loop.
- **biconomy-mcp**: Model Context Protocol integration for Biconomy services.

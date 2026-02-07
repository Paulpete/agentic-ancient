#!/usr/bin/env python3
"""
State manager for saving/loading agent state.
"""
import json
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class StateManager:
    """
    Handles persistence of the agent's state.
    """
    def __init__(self, filepath: str = 'state.json'):
        self.filepath = filepath

    async def save_state(self, state: Dict[str, Any]):
        """Save agent state to a file."""
        try:
            with open(self.filepath, 'w') as f:
                json.dump(state, f, indent=4)
            logger.info(f"Saved state to {self.filepath}")
        except Exception as e:
            logger.error(f"Failed to save state: {e}")

    async def load_state(self) -> Optional[Dict[str, Any]]:
        """Load agent state from a file."""
        try:
            with open(self.filepath, 'r') as f:
                state = json.load(f)
                logger.info(f"Loaded state from {self.filepath}")
                return state
        except FileNotFoundError:
            logger.warning("State file not found. Starting fresh.")
            return None
        except Exception as e:
            logger.error(f"Failed to load state: {e}")
            return None

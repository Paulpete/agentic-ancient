#!/usr/bin/env python3
"""
Base class for all trading strategies.
"""
from abc import ABC, abstractmethod
from typing import Dict, Any

class BaseStrategy(ABC):
    """
    Abstract base class for trading strategies.
    """
    def __init__(self, name: str, params: Dict):
        self.name = name
        self.parameters = params

    @abstractmethod
    async def generate_signal(self) -> Dict[str, Any]:
        """
        Generate a trading signal (buy, sell, hold).
        
        Returns:
            A dictionary representing the signal.
            Example: {'type': 'buy', 'asset': 'SOL', 'amount': 10}
        """
        pass

    def update_parameters(self, new_params: Dict):
        """Update strategy parameters."""
        self.parameters.update(new_params)

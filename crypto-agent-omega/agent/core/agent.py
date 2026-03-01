#!/usr/bin/env python3
"""
CryptoGene-Omega: Eternal Autonomous Agent
"""
import asyncio
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
import json

from .executor import StrategyExecutor
from .orchestrator import TaskOrchestrator
from .state_manager import StateManager
from ..strategies import (
    YieldHarvester,
    SignalSeeker,
    LiquiditySniffer,
    ArbitrageHunter,
    ZKFarmer,
    BeliefRewrite
)
from ..intelligence.genetic_algorithm import GeneticAlgorithm
from ..integrations.telegram import TelegramClient
from ..integrations.database import DatabaseClient

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class CryptoGeneOmega:
    """
    Eternal autonomous agent with self-adaptation capabilities.
    """
    
    def __init__(self):
        self.executor = StrategyExecutor()
        self.orchestrator = TaskOrchestrator()
        self.state_manager = StateManager()
        self.genetic_algorithm = GeneticAlgorithm()
        self.telegram = TelegramClient()
        self.database = DatabaseClient()
        
        # Initialize strategies
        self.strategies = {
            'yield': YieldHarvester(),
            'signal': SignalSeeker(),
            'liquidity': LiquiditySniffer(),
            'arbitrage': ArbitrageHunter(),
            'zk': ZKFarmer(),
            'belief': BeliefRewrite()
        }
        
        # Agent state
        self.is_running = False
        self.execution_count = 0
        self.last_evolution = None
        
        logger.info("🧬 CryptoGene-Omega initialized")
    
    async def initialize(self):
        """Initialize agent and load state."""
        logger.info("Initializing agent systems...")
        
        # Connect to database
        await self.database.connect()
        
        # Load previous state
        state = await self.state_manager.load_state()
        if state:
            self.execution_count = state.get('execution_count', 0)
            self.last_evolution = state.get('last_evolution')
            logger.info(f"Loaded state: {self.execution_count} executions")
        
        # Load strategy parameters from database
        for name, strategy in self.strategies.items():
            params = await self.database.get_strategy_params(name)
            if params:
                strategy.update_parameters(params)
        
        logger.info("✅ Agent initialization complete")
    
    async def execute_cycle(self):
        """
        Execute one complete agent cycle.
        
        Flow:
        1. Load current state
        2. Evaluate all strategies
        3. Execute high-confidence trades
        4. Log results
        5. Update belief scores
        6. Save state
        """
        logger.info(f"⚡ Starting execution cycle #{self.execution_count + 1}")
        
        try:
            # 1. Pre-execution checks
            health = await self.orchestrator.health_check()
            if not health['ok']:
                logger.error(f"Health check failed: {health['error']}")
                await self.telegram.send_alert(
                    f"⚠️ Health check failed: {health['error']}"
                )
                return
            
            # 2. Execute each strategy
            results = []
            for name, strategy in self.strategies.items():
                try:
                    # Check if strategy is enabled
                    if not await self.is_strategy_enabled(name):
                        continue
                    
                    # Get belief score (confidence level)
                    belief_score = await self.database.get_belief_score(name)
                    
                    # Execute strategy
                    logger.info(f"Executing {name} strategy (belief: {belief_score:.2f})")
                    result = await self.executor.execute_strategy(
                        strategy,
                        belief_score=belief_score
                    )
                    
                    results.append({
                        'strategy': name,
                        'success': result.get('success', False),
                        'profit_loss': result.get('profit_loss', 0),
                        'timestamp': datetime.utcnow().isoformat()
                    })
                    
                    # Log to database
                    await self.database.log_execution(name, result)
                    
                except Exception as e:
                    logger.error(f"Strategy {name} failed: {e}")
                    results.append({
                        'strategy': name,
                        'success': False,
                        'error': str(e)
                    })
            
            # 3. Run belief rewrite (self-adaptation)
            belief_strategy = self.strategies['belief']
            new_beliefs = await belief_strategy.rewrite(results)
            
            # Update belief scores in database
            for strategy_name, score in new_beliefs.items():
                await self.database.update_belief_score(strategy_name, score)
            
            # 4. Generate summary
            summary = self._generate_summary(results)
            logger.info(f"Cycle summary: {summary}")
            
            # 5. Send Telegram notification
            await self.telegram.send_notification(
                self._format_telegram_message(results, summary)
            )
            
            # 6. Update state
            self.execution_count += 1
            await self.state_manager.save_state({
                'execution_count': self.execution_count,
                'last_execution': datetime.utcnow().isoformat(),
                'last_summary': summary
            })
            
            logger.info(f"✅ Cycle #{self.execution_count} complete")
            
        except Exception as e:
            logger.error(f"❌ Cycle execution failed: {e}")
            await self.telegram.send_alert(f"🚨 Agent error: {e}")
            raise
    
    async def evolve(self):
        """
        Run genetic algorithm to evolve strategy parameters.
        
        This should run less frequently (e.g., daily) to allow
        strategies to accumulate performance data.
        """
        logger.info("🧬 Starting genetic algorithm evolution")
        
        try:
            # Get recent performance data
            performance_data = await self.database.get_recent_performance(days=7)
            
            # Run genetic algorithm
            evolved_params = await self.genetic_algorithm.evolve(
                current_strategies=self.strategies,
                performance_data=performance_data,
                generations=5,
                population_size=10
            )
            
            # Apply evolved parameters
            mutations_applied = 0
            for strategy_name, new_params in evolved_params.items():
                # Calculate fitness improvement
                fitness_delta = new_params.get('fitness_improvement', 0)
                
                # Only apply if improvement is significant
                if fitness_delta > 0.05:  # 5% improvement threshold
                    strategy = self.strategies.get(strategy_name)
                    if strategy:
                        strategy.update_parameters(new_params['parameters'])
                        await self.database.save_strategy_params(
                            strategy_name,
                            new_params['parameters']
                        )
                        mutations_applied += 1
                        logger.info(
                            f"Evolved {strategy_name}: "
                            f"+{fitness_delta*100:.1f}% fitness"
                        )
            
            # Send evolution report
            await self.telegram.send_notification(
                f"🧬 Evolution complete\n"
                f"Mutations applied: {mutations_applied}\n"
                f"Helix eternal. Empire compounds."
            )
            
            self.last_evolution = datetime.utcnow().isoformat()
            
        except Exception as e:
            logger.error(f"Evolution failed: {e}")
            await self.telegram.send_alert(f"🧬 Evolution error: {e}")
    
    async def is_strategy_enabled(self, strategy_name: str) -> bool:
        """Check if strategy is enabled in database."""
        return await self.database.is_strategy_enabled(strategy_name)
    
    def _generate_summary(self, results: List[Dict]) -> Dict:
        """Generate execution summary statistics."""
        total = len(results)
        successful = sum(1 for r in results if r.get('success'))
        total_pnl = sum(r.get('profit_loss', 0) for r in results)
        
        return {
            'total_strategies': total,
            'successful': successful,
            'failed': total - successful,
            'total_pnl': total_pnl,
            'win_rate': (successful / total * 100) if total > 0 else 0
        }
    
    def _format_telegram_message(self, results: List[Dict], summary: Dict) -> str:
        """Format Telegram notification message."""
        msg = f"🧬 *Agent Execution #{self.execution_count}*\n\n"
        msg += f"⚡ Strategies: {summary['total_strategies']}\n"
        msg += f"✅ Successful: {summary['successful']}\n"
        msg += f"❌ Failed: {summary['failed']}\n"
        msg += f"💰 Total P/L: {summary['total_pnl']:.4f} SOL\n"
        msg += f"📊 Win Rate: {summary['win_rate']:.1f}%\n\n"
        msg += "_Helix eternal. Empire compounds._"
        return msg
    
    async def shutdown(self):
        """Graceful shutdown."""
        logger.info("Shutting down agent...")
        self.is_running = False
        await self.database.disconnect()
        logger.info("Agent shutdown complete")


async def main():
    """Main entry point for agent execution."""
    agent = CryptoGeneOmega()
    
    try:
        await agent.initialize()
        await agent.execute_cycle()
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        raise
    finally:
        await agent.shutdown()


if __name__ == "__main__":
    asyncio.run(main())

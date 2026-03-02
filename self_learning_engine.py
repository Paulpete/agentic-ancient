#!/usr/bin/env python3
"""
self_learning_engine.py
────────────────────────
Makes Ralph agent smarter on every cycle using two complementary methods:

1. Q-Learning (Reinforcement Learning)
   - State  = (market_regime, strategy_type, recent_win_rate)
   - Action = raise_belief | lower_belief | hold
   - Reward = profit_loss normalized
   - Q-table updated after each strategy execution
   - Belief scores converge toward optimal values over time

2. Genetic Algorithm (Population Evolution)
   - Population of strategy parameter sets
   - Fitness = cumulative PnL × win_rate
   - Selection → Crossover → Mutation every EVOLVE_EVERY cycles
   - Applies best-performing params back to active strategies

3. Bayesian Belief Update
   - Tracks success probability distribution per strategy
   - Beta distribution updated on win/loss
   - Prevents overfit to recent runs (no recency bias)

Usage (standalone):
  from self_learning_engine import SelfLearningEngine
  brain = SelfLearningEngine()
  new_beliefs = brain.evolve(results, strategies)
"""

import json
import math
import os
import random
import time
import logging
from collections import defaultdict
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np

log = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
LEARNING_RATE    = 0.15       # Q-learning alpha
DISCOUNT_FACTOR  = 0.90       # Q-learning gamma — weight future rewards
EPSILON_START    = 0.3        # Exploration rate start
EPSILON_MIN      = 0.05       # Minimum exploration
EPSILON_DECAY    = 0.995      # Decay per episode
EVOLVE_EVERY     = 5          # Run GA every N cycles
POPULATION_SIZE  = 8          # GA population
MUTATION_RATE    = 0.15       # GA mutation probability
CHECKPOINT_FILE  = "/tmp/clawai_self_learning_state.json"


# ── State / Action ────────────────────────────────────────────────────────────

@dataclass
class StrategyState:
    """Tracks per-strategy Bayesian belief distribution (Beta(α, β))."""
    name: str
    alpha: float = 2.0          # Prior wins
    beta: float  = 2.0          # Prior losses
    total_pnl:   float = 0.0
    exec_count:  int   = 0
    q_state:     str   = "neutral"

    def update(self, success: bool, pnl: float):
        self.exec_count += 1
        self.total_pnl  += pnl
        if success:
            self.alpha += 1.0
        else:
            self.beta  += 1.0
            self.alpha = max(0.5, self.alpha - 0.1)   # slight decay on loss

    @property
    def bayesian_belief(self) -> float:
        """Expected value of Beta(α, β) distribution."""
        return self.alpha / (self.alpha + self.beta)

    @property
    def uncertainty(self) -> float:
        """Variance of Beta distribution — high early, low after many samples."""
        n = self.alpha + self.beta
        return (self.alpha * self.beta) / (n * n * (n + 1))

    @property
    def fitness(self) -> float:
        """Combined fitness score: PnL × win_rate × confidence."""
        if self.exec_count == 0:
            return 0.5
        win_rate = self.alpha / (self.alpha + self.beta)
        return win_rate * (1.0 + math.tanh(self.total_pnl * 5))


# ── Genetic Algorithm ─────────────────────────────────────────────────────────

@dataclass
class Individual:
    """One candidate strategy parameter set in the GA population."""
    belief_floor: float    # Minimum belief to allow execution
    risk_scale:   float    # How aggressively to adjust belief on win/loss
    decay_on_loss: float   # How much to penalize losing streaks
    fitness:      float = 0.0

    @classmethod
    def random(cls) -> "Individual":
        return cls(
            belief_floor  = random.uniform(0.2, 0.6),
            risk_scale    = random.uniform(0.05, 0.3),
            decay_on_loss = random.uniform(0.01, 0.15),
        )

    def mutate(self) -> "Individual":
        def m(v, lo, hi):
            if random.random() < MUTATION_RATE:
                return max(lo, min(hi, v + random.gauss(0, (hi - lo) * 0.1)))
            return v
        return Individual(
            belief_floor  = m(self.belief_floor,  0.1, 0.7),
            risk_scale    = m(self.risk_scale,    0.01, 0.4),
            decay_on_loss = m(self.decay_on_loss, 0.01, 0.2),
        )

    @classmethod
    def crossover(cls, a: "Individual", b: "Individual") -> "Individual":
        return cls(
            belief_floor  = (a.belief_floor  + b.belief_floor)  / 2,
            risk_scale    = a.risk_scale    if random.random() > 0.5 else b.risk_scale,
            decay_on_loss = a.decay_on_loss if random.random() > 0.5 else b.decay_on_loss,
        )


class GeneticAlgorithm:
    def __init__(self):
        self.population: List[Individual] = [Individual.random() for _ in range(POPULATION_SIZE)]
        self.generation = 0
        self.best: Optional[Individual] = None

    def evolve(self, strategy_states: Dict[str, StrategyState]) -> Individual:
        """Run one GA generation. Returns the best individual."""
        # Score each individual using actual strategy fitness
        avg_fitness = sum(s.fitness for s in strategy_states.values()) / max(len(strategy_states), 1)

        for ind in self.population:
            # Fitness = how well this param set aligns with current performance
            alignment = 1.0 - abs(ind.belief_floor - avg_fitness)
            ind.fitness = alignment * avg_fitness * (1.0 - ind.decay_on_loss)

        # Sort by fitness
        self.population.sort(key=lambda x: x.fitness, reverse=True)
        self.best = self.population[0]

        # Selection (top half survive)
        survivors = self.population[:POPULATION_SIZE // 2]

        # Generate new individuals via crossover + mutation
        children = []
        while len(children) < POPULATION_SIZE // 2:
            a, b = random.sample(survivors, 2)
            child = Individual.crossover(a, b).mutate()
            children.append(child)

        self.population = survivors + children
        self.generation += 1

        log.info(
            f"[GA] Gen {self.generation} | Best fitness={self.best.fitness:.4f} "
            f"belief_floor={self.best.belief_floor:.3f} risk_scale={self.best.risk_scale:.3f}"
        )
        return self.best


# ── Q-Learning ────────────────────────────────────────────────────────────────

class QLearner:
    """Tabular Q-learner for belief adjustment decisions."""

    ACTIONS = ["raise", "lower", "hold"]

    def __init__(self):
        # Q[state][action] = expected reward
        self.Q: Dict[str, Dict[str, float]] = defaultdict(
            lambda: {a: 0.0 for a in self.ACTIONS}
        )
        self.epsilon = EPSILON_START
        self.episode = 0

    def get_state(self, strategy: StrategyState) -> str:
        """Discretise continuous state into a string key."""
        belief = round(strategy.bayesian_belief, 1)
        pnl_trend = "up" if strategy.total_pnl > 0 else "down"
        confidence = "certain" if strategy.uncertainty < 0.02 else "uncertain"
        return f"{strategy.name}_{belief}_{pnl_trend}_{confidence}"

    def choose_action(self, state: str) -> str:
        if random.random() < self.epsilon:
            return random.choice(self.ACTIONS)      # Explore
        return max(self.Q[state], key=self.Q[state].get)  # Exploit

    def update(self, state: str, action: str, reward: float, next_state: str):
        """Q(s,a) ← Q(s,a) + α[r + γ·max Q(s',a') - Q(s,a)]"""
        current_q  = self.Q[state][action]
        max_next_q = max(self.Q[next_state].values())
        self.Q[state][action] = (
            current_q + LEARNING_RATE * (reward + DISCOUNT_FACTOR * max_next_q - current_q)
        )

    def decay_epsilon(self):
        self.epsilon = max(EPSILON_MIN, self.epsilon * EPSILON_DECAY)
        self.episode += 1


# ── Main Engine ───────────────────────────────────────────────────────────────

class SelfLearningEngine:
    """
    Orchestrates Q-learning + Genetic Algorithm + Bayesian belief updates.
    
    Call:
      new_beliefs = engine.evolve(results, strategies)
    after every Ralph cycle. Returns a dict of {strategy_name: new_belief_score}.
    """

    def __init__(self):
        self.states: Dict[str, StrategyState] = {}
        self.q = QLearner()
        self.ga = GeneticAlgorithm()
        self.cycle_count = 0
        self.history: List[Dict] = []

        self._load_checkpoint()
        log.info(f"[BRAIN] SelfLearningEngine ready | ε={self.q.epsilon:.3f} | gen={self.ga.generation}")

    def record_result(self, result: Dict):
        """Record a single strategy result (called from webhook in background)."""
        name    = result.get("strategy", "unknown")
        success = result.get("success", False)
        pnl     = float(result.get("profit_loss", 0))

        if name not in self.states:
            self.states[name] = StrategyState(name=name)

        self.states[name].update(success, pnl)

    def evolve(self, results: List[Dict], strategies: Dict) -> Dict[str, float]:
        """
        Main evolution call after each Ralph cycle.
        Returns {strategy_name: new_belief_score} dict.
        """
        self.cycle_count += 1

        # 1. Update Bayesian states from this cycle's results
        for result in results:
            self.record_result(result)

        # 2. Q-learning: choose belief adjustment for each strategy
        new_beliefs = {}

        for name, strategy_runner in strategies.items():
            if name not in self.states:
                self.states[name] = StrategyState(name=name)

            state_obj  = self.states[name]
            state_key  = self.q.get_state(state_obj)
            action     = self.q.choose_action(state_key)

            # Apply action to belief
            old_belief = strategy_runner.belief_score
            delta = strategy_runner.belief_score * 0.05  # 5% adjustment

            if action == "raise":
                new_score = min(0.95, old_belief + delta)
            elif action == "lower":
                new_score = max(0.1,  old_belief - delta)
            else:
                new_score = old_belief

            # Blend Q-learning decision with Bayesian posterior
            bayesian = state_obj.bayesian_belief
            blended  = 0.6 * new_score + 0.4 * bayesian   # 60% Q / 40% Bayes
            new_beliefs[name] = round(blended, 4)

            # Compute reward for Q-update
            recent_pnl = sum(
                r.get("profit_loss", 0)
                for r in results if r.get("strategy") == name
            )
            reward = math.tanh(recent_pnl * 10)   # Normalise to [-1, +1]

            # Q-update
            next_state = self.q.get_state(state_obj)
            self.q.update(state_key, action, reward, next_state)

        self.q.decay_epsilon()

        # 3. GA evolution every EVOLVE_EVERY cycles
        if self.cycle_count % EVOLVE_EVERY == 0:
            best_individual = self.ga.evolve(self.states)
            # Apply GA floor: clip all beliefs to GA's recommended minimum
            for name in new_beliefs:
                new_beliefs[name] = max(best_individual.belief_floor, new_beliefs[name])
            log.info(f"[GA] Applied floor={best_individual.belief_floor:.3f} to all strategies")

        # 4. Log this cycle
        self.history.append({
            "cycle": self.cycle_count,
            "timestamp": int(time.time()),
            "beliefs": new_beliefs.copy(),
            "epsilon": round(self.q.epsilon, 4),
            "ga_gen": self.ga.generation,
        })

        # Keep last 200 cycles
        if len(self.history) > 200:
            self.history = self.history[-200:]

        # 5. Checkpoint every 10 cycles
        if self.cycle_count % 10 == 0:
            self._save_checkpoint()

        log.info(
            f"[BRAIN] Cycle {self.cycle_count} | "
            f"ε={self.q.epsilon:.3f} | "
            f"GA gen={self.ga.generation} | "
            f"beliefs={', '.join(f'{k}={v:.3f}' for k,v in new_beliefs.items())}"
        )

        return new_beliefs

    def get_status(self) -> Dict:
        """Return current engine status for API/dashboard."""
        return {
            "cycle": self.cycle_count,
            "epsilon": round(self.q.epsilon, 4),
            "ga_generation": self.ga.generation,
            "ga_best_fitness": round(self.ga.best.fitness, 4) if self.ga.best else None,
            "strategies": {
                name: {
                    "bayesian_belief": round(s.bayesian_belief, 4),
                    "uncertainty": round(s.uncertainty, 5),
                    "fitness": round(s.fitness, 4),
                    "total_pnl": round(s.total_pnl, 4),
                    "exec_count": s.exec_count,
                    "alpha": round(s.alpha, 2),
                    "beta": round(s.beta, 2),
                }
                for name, s in self.states.items()
            },
            "recent_history": self.history[-5:],
        }

    def _save_checkpoint(self):
        data = {
            "cycle_count": self.cycle_count,
            "epsilon": self.q.epsilon,
            "episode": self.q.episode,
            "ga_generation": self.ga.generation,
            "states": {
                name: asdict(s) for name, s in self.states.items()
            },
            "history": self.history[-50:],
        }
        try:
            with open(CHECKPOINT_FILE, "w") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            log.warning(f"Checkpoint save failed: {e}")

    def _load_checkpoint(self):
        if not os.path.exists(CHECKPOINT_FILE):
            return
        try:
            with open(CHECKPOINT_FILE) as f:
                data = json.load(f)
            self.cycle_count    = data.get("cycle_count", 0)
            self.q.epsilon      = data.get("epsilon", EPSILON_START)
            self.q.episode      = data.get("episode", 0)
            self.ga.generation  = data.get("ga_generation", 0)
            for name, s in data.get("states", {}).items():
                self.states[name] = StrategyState(**s)
            self.history = data.get("history", [])
            log.info(f"[BRAIN] Checkpoint loaded | cycle={self.cycle_count} | ε={self.q.epsilon:.3f}")
        except Exception as e:
            log.warning(f"Checkpoint load failed: {e}")


# ── CLI ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO)

    engine = SelfLearningEngine()

    # Simulate 3 cycles for demo
    for cycle in range(3):
        fake_results = [
            {"strategy": "yield",     "success": True,  "profit_loss": 0.08},
            {"strategy": "signal",    "success": False, "profit_loss": -0.03},
            {"strategy": "liquidity", "success": True,  "profit_loss": 0.12},
            {"strategy": "zk",        "success": True,  "profit_loss": 0.05},
            {"strategy": "arbitrage", "success": False, "profit_loss": -0.01},
        ]

        class FakeStrategy:
            def __init__(self, n, b):
                self.name = n
                self.belief_score = b

        fake_strategies = {
            "yield":     FakeStrategy("yield",     0.75),
            "signal":    FakeStrategy("signal",    0.60),
            "liquidity": FakeStrategy("liquidity", 0.50),
            "zk":        FakeStrategy("zk",        0.70),
            "arbitrage": FakeStrategy("arbitrage", 0.55),
        }

        new_beliefs = engine.evolve(fake_results, fake_strategies)
        print(f"\nCycle {cycle + 1} → new beliefs:", new_beliefs)

    print("\nStatus:")
    import pprint
    pprint.pprint(engine.get_status())

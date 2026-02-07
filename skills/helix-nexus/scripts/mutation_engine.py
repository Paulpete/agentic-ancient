#!/usr/bin/env python3
"""
Genetic Algorithm Mutation Engine - Evolves skills and strategies.
Implements pygad-style mutations for continuous improvement.
"""
import json
import random
from typing import List, Dict, Any, Callable
from dataclasses import dataclass
from pathlib import Path

@dataclass
class Gene:
    """Represents a mutable piece of code or configuration."""
    id: str
    type: str  # 'code', 'config', 'strategy', 'prompt'
    content: str
    fitness: float = 0.0
    generation: int = 0

@dataclass
class Mutation:
    """Represents a proposed mutation."""
    gene_id: str
    mutation_type: str
    original: str
    mutated: str
    expected_improvement: str
    risk_level: str  # 'low', 'medium', 'high'

class FitnessFunction:
    """Multi-objective fitness evaluation."""
    
    @staticmethod
    def evaluate(gene: Gene, metrics: Dict[str, float]) -> float:
        """
        Calculate fitness score based on multiple objectives:
        - Efficiency (speed, resource usage)
        - Security (safe code patterns)
        - Yield (value generated)
        - Diversity (unique approaches)
        - Truthfulness (correct results)
        """
        weights = {
            'efficiency': 0.25,
            'security': 0.20,
            'yield': 0.25,
            'diversity': 0.15,
            'truthfulness': 0.15
        }
        
        fitness = sum(metrics.get(k, 0.5) * w for k, w in weights.items())
        return fitness

class MutationOperators:
    """Genetic algorithm mutation operators."""
    
    @staticmethod
    def point_mutation(content: str, mutation_rate: float = 0.1) -> str:
        """Random small changes (like genetic point mutations)."""
        lines = content.split('\n')
        num_mutations = max(1, int(len(lines) * mutation_rate))
        
        for _ in range(num_mutations):
            if not lines:
                break
            line_idx = random.randint(0, len(lines) - 1)
            line = lines[line_idx]
            
            # Apply random transformation
            transformations = [
                lambda l: l.replace('for', 'while'),  # Loop type
                lambda l: l.replace('if', 'if not'),  # Condition inversion
                lambda l: l + '  # Optimized',  # Add comment
                lambda l: l.strip(),  # Remove whitespace
            ]
            
            transform = random.choice(transformations)
            try:
                lines[line_idx] = transform(line)
            except:
                pass
        
        return '\n'.join(lines)
    
    @staticmethod
    def crossover(content1: str, content2: str) -> str:
        """Combine two code snippets (genetic crossover)."""
        lines1 = content1.split('\n')
        lines2 = content2.split('\n')
        
        # Take first half from content1, second half from content2
        crossover_point = len(lines1) // 2
        
        result = lines1[:crossover_point] + lines2[crossover_point:]
        return '\n'.join(result)
    
    @staticmethod
    def insertion(content: str, library: List[str]) -> str:
        """Insert proven patterns from library."""
        if not library:
            return content
        
        lines = content.split('\n')
        insert_point = random.randint(0, len(lines))
        
        pattern = random.choice(library)
        lines.insert(insert_point, pattern)
        
        return '\n'.join(lines)
    
    @staticmethod
    def deletion(content: str) -> str:
        """Remove potentially unnecessary code."""
        lines = content.split('\n')
        
        # Remove comments and empty lines
        cleaned = [l for l in lines if l.strip() and not l.strip().startswith('#')]
        
        return '\n'.join(cleaned)

class GeneticMutator:
    """Main genetic algorithm engine for skill evolution."""
    
    def __init__(self, population_size: int = 10, generations: int = 5):
        self.population_size = population_size
        self.generations = generations
        self.fitness_fn = FitnessFunction()
        self.operators = MutationOperators()
        self.mutation_history = []
        
        # Pattern library (proven good patterns)
        self.pattern_library = [
            'try:',
            'except Exception as e:',
            'return result',
            'if not data: return None',
            'with open(file) as f:',
            'for item in items:',
        ]
    
    def evolve_gene(self, gene: Gene, target_metrics: Dict[str, float]) -> Gene:
        """Evolve a single gene through multiple generations."""
        population = [gene]
        
        # Create initial population with mutations
        for _ in range(self.population_size - 1):
            mutated_content = self._apply_random_mutation(gene.content)
            mutated_gene = Gene(
                id=f"{gene.id}_mut_{_}",
                type=gene.type,
                content=mutated_content,
                generation=gene.generation + 1
            )
            population.append(mutated_gene)
        
        # Evolve for N generations
        for gen in range(self.generations):
            # Evaluate fitness
            for g in population:
                g.fitness = self.fitness_fn.evaluate(g, target_metrics)
            
            # Selection: keep top 50%
            population.sort(key=lambda g: g.fitness, reverse=True)
            survivors = population[:self.population_size // 2]
            
            # Reproduction: create offspring
            offspring = []
            for i in range(len(survivors)):
                parent1 = survivors[i]
                parent2 = survivors[(i + 1) % len(survivors)]
                
                # Crossover
                child_content = self.operators.crossover(
                    parent1.content,
                    parent2.content
                )
                
                # Mutation
                child_content = self._apply_random_mutation(child_content)
                
                child = Gene(
                    id=f"{gene.id}_gen{gen}_{i}",
                    type=gene.type,
                    content=child_content,
                    generation=gen + 1
                )
                offspring.append(child)
            
            # New population
            population = survivors + offspring
        
        # Return fittest individual
        for g in population:
            g.fitness = self.fitness_fn.evaluate(g, target_metrics)
        
        population.sort(key=lambda g: g.fitness, reverse=True)
        best = population[0]
        
        # Log mutation
        self.mutation_history.append({
            'original_id': gene.id,
            'best_id': best.id,
            'fitness_improvement': best.fitness - gene.fitness,
            'generation': best.generation
        })
        
        return best
    
    def _apply_random_mutation(self, content: str) -> str:
        """Apply a random mutation operator."""
        operators_list = [
            ('point', lambda: self.operators.point_mutation(content)),
            ('insertion', lambda: self.operators.insertion(content, self.pattern_library)),
            ('deletion', lambda: self.operators.deletion(content)),
        ]
        
        mutation_type, operator = random.choice(operators_list)
        
        try:
            return operator()
        except:
            return content
    
    def suggest_mutations(self, skill_path: Path) -> List[Mutation]:
        """Analyze a skill and suggest mutations."""
        mutations = []
        
        # Read skill scripts
        scripts_dir = skill_path / 'scripts'
        if not scripts_dir.exists():
            return mutations
        
        for script_file in scripts_dir.glob('*.py'):
            with open(script_file) as f:
                content = f.read()
            
            # Suggest mutations based on patterns
            mutations.extend(self._analyze_and_suggest(script_file.name, content))
        
        return mutations
    
    def _analyze_and_suggest(self, filename: str, content: str) -> List[Mutation]:
        """Analyze code and suggest specific mutations."""
        suggestions = []
        
        # Check for common improvements
        if 'import' in content and 'typing' not in content:
            suggestions.append(Mutation(
                gene_id=filename,
                mutation_type='add_typing',
                original='No type hints',
                mutated='Add typing.List, typing.Dict, etc.',
                expected_improvement='Better type safety and IDE support',
                risk_level='low'
            ))
        
        if 'try:' not in content and 'open(' in content:
            suggestions.append(Mutation(
                gene_id=filename,
                mutation_type='add_error_handling',
                original='No try-except',
                mutated='Wrap file operations in try-except',
                expected_improvement='More robust error handling',
                risk_level='low'
            ))
        
        if content.count('\n') > 200:
            suggestions.append(Mutation(
                gene_id=filename,
                mutation_type='split_file',
                original='Large monolithic file',
                mutated='Split into multiple modules',
                expected_improvement='Better maintainability',
                risk_level='medium'
            ))
        
        return suggestions

def main():
    """CLI for genetic mutator."""
    import sys
    
    if len(sys.argv) < 3:
        print("Usage:")
        print("  mutation_engine.py suggest <skill-path>")
        print("  mutation_engine.py evolve <gene-file>")
        sys.exit(1)
    
    command = sys.argv[1]
    
    mutator = GeneticMutator()
    
    if command == 'suggest':
        skill_path = Path(sys.argv[2])
        mutations = mutator.suggest_mutations(skill_path)
        
        print(f"\n🧬 Mutation Suggestions for {skill_path.name}")
        print("=" * 60)
        
        for i, mut in enumerate(mutations, 1):
            print(f"\n{i}. {mut.mutation_type.upper()} [{mut.risk_level} risk]")
            print(f"   Gene: {mut.gene_id}")
            print(f"   Original: {mut.original}")
            print(f"   Mutated: {mut.mutated}")
            print(f"   Expected: {mut.expected_improvement}")
    
    elif command == 'evolve':
        gene_file = Path(sys.argv[2])
        
        with open(gene_file) as f:
            content = f.read()
        
        gene = Gene(
            id=gene_file.name,
            type='code',
            content=content
        )
        
        # Example target metrics
        target = {
            'efficiency': 0.8,
            'security': 0.9,
            'yield': 0.7,
            'diversity': 0.6,
            'truthfulness': 0.95
        }
        
        print(f"🧬 Evolving {gene.id}...")
        evolved = mutator.evolve_gene(gene, target)
        
        print(f"\n✓ Evolution complete!")
        print(f"  Generations: {evolved.generation}")
        print(f"  Fitness: {evolved.fitness:.3f}")
        print(f"\nMutation history:")
        for record in mutator.mutation_history:
            print(f"  {record}")

if __name__ == "__main__":
    main()

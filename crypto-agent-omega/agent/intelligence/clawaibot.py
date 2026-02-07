#!/usr/bin/env python3
import requests
import json

class ClawAIBot:
    def __init__(self, model="qwen2.5-coder:7b"):
        self.model = model
        self.base_url = "http://localhost:11434/api"
    
    def generate(self, prompt: str) -> str:
        """Generate code using free Ollama models"""
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False
        }
        resp = requests.post(f"{self.base_url}/generate", json=payload)
        return resp.json()['response']
    
    def mutate_code(self, code: str, instruction: str) -> str:
        """Mutate existing code with AI"""
        prompt = f"{instruction}\n\nOriginal code:\n{code}\n\nImproved code:"
        return self.generate(prompt)
    
    def fix_bugs(self, code: str, error: str) -> str:
        """Fix bugs in code"""
        prompt = f"Fix this error:\n{error}\n\nCode:\n{code}\n\nFixed code:"
        return self.generate(prompt)

if __name__ == "__main__":
    bot = ClawAIBot()
    result = bot.generate("Write a Solana transaction builder in Python")
    print("🤖 ClawAIBot generated:")
    print(result[:500])

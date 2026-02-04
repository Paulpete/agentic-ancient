import dateparser
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

class AncientEngine:
    def __init__(self):
        self.vectorizer = TfidfVectorizer()

    def qualify(self, opportunity):
        """Qualifies an opportunity based on its content."""
        # Simple keyword-based scoring for now.
        # A more advanced model would be trained on historical data.
        title = opportunity.get('title', '')
        summary = opportunity.get('summary', '')
        content = f"{title} {summary}"

        score = 0
        if "airdrop" in content.lower():
            score += 0.3
        if "testnet" in content.lower():
            score += 0.2
        if "grant" in content.lower():
            score += 0.2
        if "solana" in content.lower():
            score += 0.1
        if "unichain" in content.lower():
            score += 0.1
        if "evm" in content.lower():
            score += 0.1

        return score

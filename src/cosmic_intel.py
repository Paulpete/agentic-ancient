import aiohttp
import feedparser
import json

class CosmicIntel:
    def __init__(self):
        with open("configs/allowlists.json", "r") as f:
            self.config = json.load(f)

    async def gather_intel(self):
        """Gathers intelligence from various sources."""
        opportunities = []
        for source in self.config["sources"]:
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get(source) as response:
                        if response.status == 200:
                            feed_data = await response.text()
                            feed = feedparser.parse(feed_data)
                            for entry in feed.entries:
                                opportunities.append({
                                    "title": entry.title,
                                    "summary": entry.summary,
                                    "link": entry.link
                                })
            except Exception as e:
                print(f"Error fetching intel from {source}: {e}")
        return opportunities

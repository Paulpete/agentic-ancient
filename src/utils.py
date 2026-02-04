import os
import aiohttp

async def send_telegram_notification(message):
    """Sends a notification to Telegram."""
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {"chat_id": chat_id, "text": message}
    async with aiohttp.ClientSession() as session:
        await session.post(url, json=payload)

async def send_reown_notification(message):
    """Sends a notification to the Reown AppKit."""
    project_id = os.getenv("REOWN_PROJECT_ID")
    # This is a placeholder for the actual Reown notification logic.
    print(f"Sending Reown notification to project {project_id}: {message}")
    await asyncio.sleep(1) # Simulate API call

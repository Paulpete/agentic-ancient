import argparse
import asyncio
from src.alien_hunter import AlienHunter

def main():
    parser = argparse.ArgumentParser(description='Agentic Ancient Alien - Crypto Opportunity Hunter')
    parser.add_argument('--daemon', action='store_true', help='Run the agent in daemon mode.')
    parser.add_argument('--scan-only', action='store_true', help='Run a single scan and then exit.')
    args = parser.parse_args()

    hunter = AlienHunter()

    if args.daemon:
        print("Starting Agentic Ancient Alien in daemon mode...")
        asyncio.run(hunter.run_daemon())
    elif args.scan_only:
        print("Running a single scan...")
        asyncio.run(hunter.scan())
    else:
        parser.print_help()

if __name__ == "__main__":
    main()

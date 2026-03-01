import { RalphLoop } from './lib/ralph/loop'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function main() {
  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
  const THIRTY_MIN_MS = 30 * 60 * 1000;
  
  const loop = new RalphLoop(THIRTY_MIN_MS);
  console.log('🚀 Starting Ralph Loop for 6 hours (30-minute interval)...');
  
  // Start the loop in the background
  loop.start().catch(err => console.error('❌ Ralph Loop Error:', err));
  
  // Set a timeout to stop the loop after 6 hours
  setTimeout(() => {
    console.log('🛑 6 hours reached. Stopping Ralph Loop...');
    loop.stop();
    process.exit(0);
  }, SIX_HOURS_MS);
  
  // Keep the process alive
  console.log('✅ Ralph Loop is now running. This process will exit in 6 hours.');
}

main().catch(console.error)

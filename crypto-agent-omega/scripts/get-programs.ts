import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const cluster = process.env.SOLANA_CLUSTER || 'mainnet-beta';

async function getPrograms() {
    try {
        const { stdout } = await execAsync(`solana program show --programs --url ${cluster}`);
        console.log(stdout);
    } catch (error) {
        console.error('Error:', error);
    }
}

getPrograms();
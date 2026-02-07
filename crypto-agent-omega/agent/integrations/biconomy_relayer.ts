import { ethers } from 'ethers';
import { BiconomySmartAccountV2, DEFAULT_ENTRYPOINT_ADDRESS } from '@biconomy/account';
import { Bundler } from '@biconomy/bundler';
import { ChainId } from '@biconomy/core-types';

export class OmegaRelayer {
    private smartAccount: BiconomySmartAccountV2 | null = null;
    
    async init(signerAddress: string) {
        const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC_ENDPOINT);
        const signer = new ethers.Wallet(process.env.ETH_PRIVATE_KEY!, provider);
        
        const config = {
            signer,
            chainId: ChainId.BASE_MAINNET,
            bundlerUrl: `https://bundler.biconomy.io/api/v2/8453/${process.env.BICONOMY_API_KEY}`,
            biconomyPaymasterApiKey: process.env.BICONOMY_API_KEY!
        };
        
        this.smartAccount = await BiconomySmartAccountV2.create(config);
        console.log('✅ Omega Relayer initialized');
    }
    
    async executeGasless(to: string, data: string, value: bigint = 0n) {
        if (!this.smartAccount) throw new Error('Not initialized');
        
        const tx = { to, data, value };
        const userOp = await this.smartAccount.buildUserOp([tx]);
        const response = await this.smartAccount.sendUserOp(userOp);
        const { transactionHash } = await response.waitForTxHash();
        
        console.log(`✅ Gasless TX: ${transactionHash}`);
        return transactionHash;
    }
}

export const relayer = new OmegaRelayer();

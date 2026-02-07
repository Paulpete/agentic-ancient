
import { createSmartAccountClient } from "@biconomy/account";
import { ethers } from "ethers";

// Biconomy integration using the provided API key
export class Biconomy {
    private biconomySmartAccount: any;

    constructor() {
        if (!process.env.BICONOMY_API_KEY) {
            throw new Error("BICONOMY_API_KEY is not set in environment variables");
        }
        if (!process.env.ETH_PRIVATE_KEY) {
            throw new Error("ETH_PRIVATE_KEY is not set in environment variables");
        }
         this.setupBiconomy();
    }

    private async setupBiconomy() {
        console.log("Setting up Biconomy Smart Account...");
        const provider = new ethers.JsonRpcProvider("https://rpc.ankr.com/polygon_mumbai");
        const signer = new ethers.Wallet(process.env.ETH_PRIVATE_KEY as string, provider);

        const smartAccountConfig = {
            signer,
            chainId: 80001, // Polygon Mumbai
            bundlerUrl: `https://bundler.biconomy.io/api/v2/80001/nJPK7B32G.7f948574-142f-456a-af40-53d35667b369`, // From Biconomy Dashboard
            paymasterUrl: `https://paymaster.biconomy.io/api/v1/80001/${process.env.BICONOMY_API_KEY}`,
        };

        this.biconomySmartAccount = await createSmartAccountClient(smartAccountConfig);
        const saAddress = await this.biconomySmartAccount.getAccountAddress();
        console.log("Biconomy Smart Account initialized:", saAddress);
    }

    // Implement Biconomy relayer logic here
    // For example, a method to send a gasless transaction
    async sendGaslessTransaction() {
        if (!this.biconomySmartAccount) {
            await this.setupBiconomy();
        }

        console.log("Sending gasless transaction...");

        const tx = {
            to: "0x6d6F55C6736A7e6459f28FA95bbf59A97986EF23",
            value: ethers.parseEther("0.001"),
        };

        try {
            const userOp = await this.biconomySmartAccount.buildUserOp([tx]);
            const userOpResponse = await this.biconomySmartAccount.sendUserOp(userOp);
            
            console.log("UserOp hash:", userOpResponse.userOpHash);
            
            const transactionDetails = await userOpResponse.wait();
            
            console.log("Transaction successful!");
            console.log("Transaction URL:", `https://www.biconomy.io/dashboard/user-operations/${transactionDetails.receipt.transactionHash}`);
            
            return {
                hash: transactionDetails.receipt.transactionHash,
                receipt: transactionDetails.receipt,
            };
        } catch (error) {
            console.error("Error sending gasless transaction:", error);
            throw error;
        }
    }
}

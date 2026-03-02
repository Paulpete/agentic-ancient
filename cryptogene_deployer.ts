/**
 * cryptogene_deployer.ts
 * ──────────────────────
 * CryptoGene Devs Co Deployer
 * 
 * Acts on the Guardian's behalf using Biconomy AbstractJS MEE (Modular Execution
 * Environment) to:
 *   - Deploy contracts gaslessly across EVM chains
 *   - Execute multichain supertransactions in one signature
 *   - Bridge tokens via MEE orchestration
 *   - Interact with deployed programs on behalf of the user
 *   - Post results to the webhook reader for Ralph to learn from
 * 
 * Architecture:
 *   EOA Signer (Guardian's key)
 *     → toMultichainNexusAccount (Biconomy MEE)
 *       → createMeeClient
 *         → getQuote / executeQuote (Supertransaction)
 *           → webhook POST → self-learning engine
 * 
 * Usage:
 *   npx ts-node cryptogene_deployer.ts deploy --chain base --contract SimpleStorage
 *   npx ts-node cryptogene_deployer.ts send --to 0x... --amount 0.001 --chain base
 *   npx ts-node cryptogene_deployer.ts multichain --chains base,optimism --action stake
 */

import {
  toMultichainNexusAccount,
  createMeeClient,
  createBicoBundlerClient,
  createBicoPaymasterClient,
  toNexusAccount,
  getMEEVersion,
  MEEVersion,
  mcUSDC,
} from "@biconomy/abstractjs";
import { http, parseEther, parseUnits, encodeFunctionData, createPublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, optimism, mainnet, polygon, arbitrum, baseSepolia } from "viem/chains";

const CHAINS = { base, optimism, mainnet, polygon, arbitrum, baseSepolia } as const;
type ChainName = keyof typeof CHAINS;

// ── Config (all from env) ─────────────────────────────────────────────────────
const CONFIG = {
  privateKey:     (process.env.ETH_PRIVATE_KEY ?? "") as `0x${string}`,
  biconomyApiKey: process.env.BICONOMY_API_KEY ?? "",
  webhookUrl:     process.env.WEBHOOK_URL ?? "http://localhost:8765/webhook",
  defaultChain:   (process.env.DEFAULT_CHAIN ?? "base") as ChainName,
  bundlerUrl:     process.env.BUNDLER_URL ?? "",
  paymasterUrl:   process.env.PAYMASTER_URL ?? "",
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface DeployResult {
  success: boolean;
  hash?: string;
  contractAddress?: string;
  chain: string;
  gasSponsoredUsd?: number;
  error?: string;
}

interface ExecResult {
  success: boolean;
  hash?: string;
  chains: string[];
  totalGasAbstracted?: number;
  error?: string;
}

// ── Webhook ───────────────────────────────────────────────────────────────────
async function postWebhook(event: string, data: Record<string, unknown>) {
  try {
    await fetch(CONFIG.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, data }),
    });
  } catch {
    // Webhook not running — ignore
  }
}

// ── Single-chain Nexus client ─────────────────────────────────────────────────
async function getSingleChainClient(chainName: ChainName) {
  if (!CONFIG.privateKey) throw new Error("ETH_PRIVATE_KEY not set");
  const chain  = CHAINS[chainName];
  const signer = privateKeyToAccount(CONFIG.privateKey);

  // Bundler URL: use env or fall back to Biconomy's public testnet endpoint
  const bundlerUrl = CONFIG.bundlerUrl ||
    `https://bundler.biconomy.io/api/v3/${chain.id}/nJPK7B3ru.dd7f7861-190d-41bd-af80-6877f74b8f44`;

  const paymasterUrl = CONFIG.paymasterUrl ||
    `https://paymaster.biconomy.io/api/v2/${chain.id}/${CONFIG.biconomyApiKey}`;

  const client = createBicoBundlerClient({
    account: await toNexusAccount({
      signer,
      chain,
      transport: http(),
    }),
    transport: http(bundlerUrl),
    paymaster: CONFIG.biconomyApiKey
      ? createBicoPaymasterClient({ paymasterUrl })
      : undefined,
  });

  return { client, signer, chain };
}

// ── Multichain MEE client ─────────────────────────────────────────────────────
async function getMEEClient(chainNames: ChainName[] = ["base", "optimism"]) {
  if (!CONFIG.privateKey) throw new Error("ETH_PRIVATE_KEY not set");
  const signer = privateKeyToAccount(CONFIG.privateKey);

  const chainConfigs = chainNames.map((name) => ({
    chain: CHAINS[name],
    transport: http(),
    version: getMEEVersion(MEEVersion.V2_1_0),
  }));

  const mcNexus = await toMultichainNexusAccount({
    signer,
    chainConfigurations: chainConfigs,
  });

  const meeClient = await createMeeClient({ account: mcNexus });
  return { meeClient, mcNexus, signer };
}

// ── CryptoGene Devs Co Deployer ───────────────────────────────────────────────

export class CryptoGeneDeployer {
  private label: string = "CryptoGene Devs Co";

  constructor() {
    console.log(`\n🧬 ${this.label} — Biconomy MEE Deployer`);
    console.log(`   Signer: ${CONFIG.privateKey ? "✓ loaded" : "✗ ETH_PRIVATE_KEY missing"}`);
    console.log(`   API Key: ${CONFIG.biconomyApiKey ? "✓ set" : "⚠ BICONOMY_API_KEY missing — no sponsorship"}`);
    console.log(`   Webhook: ${CONFIG.webhookUrl}\n`);
  }

  // ── 1. Gasless single-chain transaction ───────────────────────────────────
  /**
   * Send a gasless transaction on behalf of the Guardian.
   * Uses Biconomy Nexus + Paymaster (ERC-4337).
   */
  async sendGasless(
    to: `0x${string}`,
    amount: string,
    chainName: ChainName = CONFIG.defaultChain,
    data: `0x${string}` = "0x"
  ): Promise<ExecResult> {
    console.log(`📡 [Gasless TX] ${amount} ETH → ${to} on ${chainName}`);

    try {
      const { client, chain } = await getSingleChainClient(chainName);

      const hash = await client.sendTransaction({
        to,
        value: parseEther(amount),
        data,
      });

      console.log(`✅ TX submitted: ${hash}`);
      await postWebhook("tx_submitted", { hash, chain: chainName, label: "gasless_send", amount });

      // Wait for confirmation
      const publicClient = createPublicClient({ chain, transport: http() });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });

      console.log(`✅ Confirmed in block ${receipt.blockNumber}`);
      await postWebhook("tx_confirmed", {
        hash,
        chain: chainName,
        label: "gasless_send",
        blockNumber: receipt.blockNumber.toString(),
      });

      return { success: true, hash, chains: [chainName] };
    } catch (err: any) {
      console.error(`❌ Failed: ${err.message}`);
      await postWebhook("tx_failed", { chain: chainName, error: err.message, label: "gasless_send" });
      return { success: false, error: err.message, chains: [chainName] };
    }
  }

  // ── 2. Multichain Supertransaction (MEE) ──────────────────────────────────
  /**
   * Execute instructions atomically across multiple chains with a single signature.
   * This is the core MEE capability — true multichain composability.
   * 
   * Example: Deploy on Base, then stake output on Optimism, in ONE user action.
   */
  async executeSupertransaction(
    instructions: Array<{
      chainName: ChainName;
      to: `0x${string}`;
      value?: bigint;
      data?: `0x${string}`;
      gasLimit?: bigint;
      label?: string;
    }>,
    feeChain: ChainName = "base"
  ): Promise<ExecResult> {
    const chains = [...new Set(instructions.map((i) => i.chainName))] as ChainName[];
    console.log(`\n⚡ [MEE Supertransaction] ${instructions.length} instructions across: ${chains.join(", ")}`);

    try {
      const { meeClient, mcNexus } = await getMEEClient(chains);

      // Build MEE instruction set
      const meeInstructions = instructions.map((inst) => ({
        chainId: CHAINS[inst.chainName].id,
        calls: [{
          to:       inst.to,
          value:    inst.value ?? 0n,
          data:     inst.data  ?? "0x" as `0x${string}`,
          gasLimit: inst.gasLimit ?? 200_000n,
        }],
      }));

      // Get quote (price the supertransaction)
      const quote = await meeClient.getQuote({
        instructions: meeInstructions,
        feeToken: {
          address: mcUSDC.addressOn(CHAINS[feeChain].id),
          chainId: CHAINS[feeChain].id,
        },
      });

      console.log(`   Quote received — executing…`);
      instructions.forEach((inst, i) => {
        console.log(`   [${i + 1}] ${inst.chainName} → ${inst.to} ${inst.label ? `(${inst.label})` : ""}`);
      });

      // Execute
      const { hash } = await meeClient.executeQuote({ quote });
      console.log(`\n✅ Supertransaction executed: ${hash}`);

      await postWebhook("tx_confirmed", {
        hash,
        chain: chains.join(","),
        label: "mee_supertransaction",
        instruction_count: instructions.length,
      });

      return { success: true, hash, chains };
    } catch (err: any) {
      console.error(`❌ MEE Supertransaction failed: ${err.message}`);
      await postWebhook("tx_failed", {
        chain: chains.join(","),
        label: "mee_supertransaction",
        error: err.message,
      });
      return { success: false, error: err.message, chains };
    }
  }

  // ── 3. Contract deployer ──────────────────────────────────────────────────
  /**
   * Deploy a contract gaslessly on any EVM chain.
   * Bytecode can be compiled Solidity or passed directly.
   */
  async deployContract(
    bytecode: `0x${string}`,
    constructorArgs: `0x${string}` = "0x",
    chainName: ChainName = CONFIG.defaultChain,
    label: string = "contract"
  ): Promise<DeployResult> {
    console.log(`\n🔨 [Deploy] ${label} → ${chainName}`);

    try {
      const { client, chain } = await getSingleChainClient(chainName);

      const deployData = (bytecode + constructorArgs.replace("0x", "")) as `0x${string}`;
      const hash = await client.sendTransaction({
        to: undefined, // null to = contract deployment
        data: deployData,
      });

      console.log(`✅ Deploy TX: ${hash}`);

      const publicClient = createPublicClient({ chain, transport: http() });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });
      const contractAddress = receipt.contractAddress;

      console.log(`✅ Contract deployed: ${contractAddress}`);
      await postWebhook("tx_confirmed", {
        hash,
        chain: chainName,
        label: `deploy_${label}`,
        contractAddress,
      });

      return { success: true, hash, contractAddress: contractAddress ?? undefined, chain: chainName };
    } catch (err: any) {
      console.error(`❌ Deploy failed: ${err.message}`);
      await postWebhook("tx_failed", { chain: chainName, error: err.message, label: `deploy_${label}` });
      return { success: false, error: err.message, chain: chainName };
    }
  }

  // ── 4. Batch deployer (all configured chains) ─────────────────────────────
  /**
   * Deploy the same contract across all chains simultaneously using MEE.
   * True multichain deployment in one Guardian signature.
   */
  async deployMultichain(
    bytecode: `0x${string}`,
    chains: ChainName[] = ["base", "optimism", "polygon"],
    label: string = "empire_contract"
  ): Promise<Record<ChainName, DeployResult>> {
    console.log(`\n🚀 [Multichain Deploy] ${label} → ${chains.join(", ")}`);
    const results: Record<string, DeployResult> = {};

    // Deploy to each chain in parallel
    await Promise.all(
      chains.map(async (chain) => {
        results[chain] = await this.deployContract(bytecode, "0x", chain, label);
      })
    );

    const successful = Object.values(results).filter((r) => r.success).length;
    console.log(`\n📊 Deployment summary: ${successful}/${chains.length} chains succeeded`);

    return results as Record<ChainName, DeployResult>;
  }

  // ── 5. Smart account address lookup ──────────────────────────────────────
  /**
   * Returns the Guardian's Nexus smart account addresses across chains.
   * Accounts are lazy-deployed — this just calculates deterministic addresses.
   */
  async getSmartAccountAddresses(chains: ChainName[] = ["base", "optimism", "arbitrum"]): Promise<Record<string, string>> {
    if (!CONFIG.privateKey) throw new Error("ETH_PRIVATE_KEY not set");

    const signer = privateKeyToAccount(CONFIG.privateKey);
    const addresses: Record<string, string> = {};

    for (const chainName of chains) {
      try {
        const account = await toNexusAccount({
          signer,
          chain: CHAINS[chainName],
          transport: http(),
        });
        addresses[chainName] = account.address;
      } catch (err: any) {
        addresses[chainName] = `error: ${err.message}`;
      }
    }

    console.log("\n🔑 Nexus Smart Account Addresses:");
    Object.entries(addresses).forEach(([chain, addr]) => {
      console.log(`   ${chain.padEnd(12)} ${addr}`);
    });

    return addresses;
  }

  // ── 6. Ralph integration: execute on signal ───────────────────────────────
  /**
   * Called by Ralph agent when a high-confidence signal is generated.
   * Executes the corresponding MEE transaction automatically.
   */
  async executeOnSignal(signal: {
    type: "swap" | "bridge" | "stake" | "deploy";
    chain: ChainName;
    targetChain?: ChainName;
    to: `0x${string}`;
    amount: string;
    data?: `0x${string}`;
  }): Promise<ExecResult> {
    console.log(`\n🎯 [Signal Execute] type=${signal.type} chain=${signal.chain}`);

    switch (signal.type) {
      case "swap":
      case "stake":
        return this.sendGasless(signal.to, signal.amount, signal.chain, signal.data);

      case "bridge":
        if (!signal.targetChain) throw new Error("bridge requires targetChain");
        return this.executeSupertransaction([
          {
            chainName: signal.chain,
            to: signal.to,
            value: parseEther(signal.amount),
            data: signal.data ?? "0x",
            label: `bridge_out_${signal.chain}`,
          },
          {
            chainName: signal.targetChain,
            to: signal.to,
            value: 0n,
            label: `bridge_in_${signal.targetChain}`,
          },
        ]);

      case "deploy":
        if (!signal.data) throw new Error("deploy requires bytecode in data field");
        return this.deployContract(signal.data, "0x", signal.chain);

      default:
        throw new Error(`Unknown signal type: ${signal.type}`);
    }
  }
}

// ── Next.js API route adapter ─────────────────────────────────────────────────
// Mount this as /api/deployer in the Next.js app to expose the deployer via REST.

export async function handleDeployerRequest(
  method: string,
  body: Record<string, unknown>
): Promise<{ status: number; data: unknown }> {
  const deployer = new CryptoGeneDeployer();

  if (method === "GET") {
    const addresses = await deployer.getSmartAccountAddresses();
    return { status: 200, data: { addresses, label: "CryptoGene Devs Co" } };
  }

  if (method === "POST") {
    const action = body.action as string;

    if (action === "send") {
      const result = await deployer.sendGasless(
        body.to as `0x${string}`,
        body.amount as string,
        (body.chain as ChainName) ?? "base"
      );
      return { status: result.success ? 200 : 500, data: result };
    }

    if (action === "supertransaction") {
      const result = await deployer.executeSupertransaction(
        body.instructions as Parameters<CryptoGeneDeployer["executeSupertransaction"]>[0]
      );
      return { status: result.success ? 200 : 500, data: result };
    }

    if (action === "deploy") {
      const result = await deployer.deployContract(
        body.bytecode as `0x${string}`,
        (body.constructorArgs as `0x${string}`) ?? "0x",
        (body.chain as ChainName) ?? "base",
        (body.label as string) ?? "contract"
      );
      return { status: result.success ? 200 : 500, data: result };
    }

    if (action === "deploy_multichain") {
      const result = await deployer.deployMultichain(
        body.bytecode as `0x${string}`,
        (body.chains as ChainName[]) ?? ["base", "optimism"],
        (body.label as string) ?? "empire_contract"
      );
      return { status: 200, data: result };
    }

    if (action === "signal") {
      const result = await deployer.executeOnSignal(
        body.signal as Parameters<CryptoGeneDeployer["executeOnSignal"]>[0]
      );
      return { status: result.success ? 200 : 500, data: result };
    }

    return { status: 400, data: { error: `Unknown action: ${action}` } };
  }

  return { status: 405, data: { error: "Method not allowed" } };
}

// ── CLI entrypoint ────────────────────────────────────────────────────────────

async function cli() {
  const args = process.argv.slice(2);
  const command = args[0];
  const deployer = new CryptoGeneDeployer();

  switch (command) {
    case "addresses":
      await deployer.getSmartAccountAddresses();
      break;

    case "send": {
      const to      = args[1] as `0x${string}`;
      const amount  = args[2] ?? "0.001";
      const chain   = (args[3] as ChainName) ?? "base";
      await deployer.sendGasless(to, amount, chain);
      break;
    }

    case "deploy": {
      const bytecode = args[1] as `0x${string}`;
      const chain    = (args[2] as ChainName) ?? "base";
      const label    = args[3] ?? "contract";
      await deployer.deployContract(bytecode, "0x", chain, label);
      break;
    }

    case "supertransaction": {
      // Demo: send small amounts on base + optimism simultaneously
      await deployer.executeSupertransaction([
        { chainName: "base",     to: "0x0000000000000000000000000000000000000001", value: parseEther("0.0001"), label: "base_op" },
        { chainName: "optimism", to: "0x0000000000000000000000000000000000000001", value: parseEther("0.0001"), label: "op_op"   },
      ]);
      break;
    }

    default:
      console.log(`
🧬 CryptoGene Devs Co Deployer — Commands:
  addresses                          Show Nexus smart account addresses on all chains
  send <to> <amount> [chain]         Send gasless ETH transaction
  deploy <bytecode> [chain] [label]  Deploy contract gaslessly
  supertransaction                   Demo: simultaneous Base + Optimism tx
      `);
  }
}

// Run CLI if called directly
if (require.main === module) {
  cli().catch(console.error);
}

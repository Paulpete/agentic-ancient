module.exports = [
"[externals]/react/jsx-dev-runtime [external] (react/jsx-dev-runtime, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("react/jsx-dev-runtime", () => require("react/jsx-dev-runtime"));

module.exports = mod;
}),
"[project]/lib/ethereum/biconomy.ts [ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "Biconomy",
    ()=>Biconomy
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f40$biconomy$2f$account__$5b$external$5d$__$2840$biconomy$2f$account$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$biconomy$2f$account$29$__ = __turbopack_context__.i("[externals]/@biconomy/account [external] (@biconomy/account, esm_import, [project]/node_modules/@biconomy/account)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$ethers__$5b$external$5d$__$28$ethers$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$ethers$29$__ = __turbopack_context__.i("[externals]/ethers [external] (ethers, esm_import, [project]/node_modules/ethers)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$externals$5d2f40$biconomy$2f$account__$5b$external$5d$__$2840$biconomy$2f$account$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$biconomy$2f$account$29$__,
    __TURBOPACK__imported__module__$5b$externals$5d2f$ethers__$5b$external$5d$__$28$ethers$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$ethers$29$__
]);
[__TURBOPACK__imported__module__$5b$externals$5d2f40$biconomy$2f$account__$5b$external$5d$__$2840$biconomy$2f$account$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$biconomy$2f$account$29$__, __TURBOPACK__imported__module__$5b$externals$5d2f$ethers__$5b$external$5d$__$28$ethers$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$ethers$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
class Biconomy {
    biconomySmartAccount;
    constructor(){
        if (!process.env.BICONOMY_API_KEY) {
            throw new Error("BICONOMY_API_KEY is not set in environment variables");
        }
        if (!process.env.ETH_PRIVATE_KEY) {
            throw new Error("ETH_PRIVATE_KEY is not set in environment variables");
        }
        this.setupBiconomy();
    }
    async setupBiconomy() {
        console.log("Setting up Biconomy Smart Account...");
        const provider = new __TURBOPACK__imported__module__$5b$externals$5d2f$ethers__$5b$external$5d$__$28$ethers$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$ethers$29$__["ethers"].JsonRpcProvider("https://rpc.ankr.com/polygon_mumbai");
        const signer = new __TURBOPACK__imported__module__$5b$externals$5d2f$ethers__$5b$external$5d$__$28$ethers$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$ethers$29$__["ethers"].Wallet(process.env.ETH_PRIVATE_KEY, provider);
        const smartAccountConfig = {
            signer,
            chainId: 80001,
            bundlerUrl: `https://bundler.biconomy.io/api/v2/80001/nJPK7B32G.7f948574-142f-456a-af40-53d35667b369`,
            paymasterUrl: `https://paymaster.biconomy.io/api/v1/80001/${process.env.BICONOMY_API_KEY}`
        };
        this.biconomySmartAccount = await (0, __TURBOPACK__imported__module__$5b$externals$5d2f40$biconomy$2f$account__$5b$external$5d$__$2840$biconomy$2f$account$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$biconomy$2f$account$29$__["createSmartAccountClient"])(smartAccountConfig);
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
            value: __TURBOPACK__imported__module__$5b$externals$5d2f$ethers__$5b$external$5d$__$28$ethers$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$ethers$29$__["ethers"].parseEther("0.001")
        };
        try {
            const userOp = await this.biconomySmartAccount.buildUserOp([
                tx
            ]);
            const userOpResponse = await this.biconomySmartAccount.sendUserOp(userOp);
            console.log("UserOp hash:", userOpResponse.userOpHash);
            const transactionDetails = await userOpResponse.wait();
            console.log("Transaction successful!");
            console.log("Transaction URL:", `https://www.biconomy.io/dashboard/user-operations/${transactionDetails.receipt.transactionHash}`);
            return {
                hash: transactionDetails.receipt.transactionHash,
                receipt: transactionDetails.receipt
            };
        } catch (error) {
            console.error("Error sending gasless transaction:", error);
            throw error;
        }
    }
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[project]/pages/index.tsx [ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "default",
    ()=>Home
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/react/jsx-dev-runtime [external] (react/jsx-dev-runtime, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$react__$5b$external$5d$__$28$react$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/react [external] (react, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$ethereum$2f$biconomy$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/ethereum/biconomy.ts [ssr] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$ethereum$2f$biconomy$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$ethereum$2f$biconomy$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
;
function Home() {
    const [isSending, setIsSending] = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react__$5b$external$5d$__$28$react$2c$__cjs$29$__["useState"])(false);
    const [txHash, setTxHash] = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react__$5b$external$5d$__$28$react$2c$__cjs$29$__["useState"])(null);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react__$5b$external$5d$__$28$react$2c$__cjs$29$__["useState"])(null);
    const handleSendTransaction = async ()=>{
        setIsSending(true);
        setError(null);
        setTxHash(null);
        try {
            const biconomy = new __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$ethereum$2f$biconomy$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__["Biconomy"]();
            const result = await biconomy.sendGaslessTransaction();
            if (result && result.hash) {
                setTxHash(result.hash);
            }
        } catch (err) {
            console.error(err);
            setError(err.message || "An error occurred.");
        } finally{
            setIsSending(false);
        }
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("main", {
        className: `flex min-h-screen flex-col items-center justify-center p-24`,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("div", {
            className: "z-10 max-w-5xl w-full items-center justify-center font-mono text-sm flex flex-col",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("h1", {
                    className: "text-4xl font-bold mb-8",
                    children: "Biconomy Gasless Demo"
                }, void 0, false, {
                    fileName: "[project]/pages/index.tsx",
                    lineNumber: 34,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("button", {
                    onClick: handleSendTransaction,
                    disabled: isSending,
                    className: "px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors duration-300",
                    children: isSending ? 'Sending...' : 'Send 0.001 ETH (Gasless)'
                }, void 0, false, {
                    fileName: "[project]/pages/index.tsx",
                    lineNumber: 36,
                    columnNumber: 9
                }, this),
                txHash && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("div", {
                    className: "mt-8 text-center",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("p", {
                            className: "text-green-500 font-bold",
                            children: "Transaction Successful!"
                        }, void 0, false, {
                            fileName: "[project]/pages/index.tsx",
                            lineNumber: 46,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("p", {
                            className: "mt-2",
                            children: [
                                "Transaction Hash: ",
                                txHash
                            ]
                        }, void 0, true, {
                            fileName: "[project]/pages/index.tsx",
                            lineNumber: 47,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("a", {
                            href: `https://www.biconomy.io/dashboard/user-operations/${txHash}`,
                            target: "_blank",
                            rel: "noopener noreferrer",
                            className: "text-blue-500 hover:underline mt-2 block",
                            children: "View on Biconomy Dashboard"
                        }, void 0, false, {
                            fileName: "[project]/pages/index.tsx",
                            lineNumber: 48,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/pages/index.tsx",
                    lineNumber: 45,
                    columnNumber: 11
                }, this),
                error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("div", {
                    className: "mt-8 text-center",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("p", {
                            className: "text-red-500 font-bold",
                            children: "Transaction Failed"
                        }, void 0, false, {
                            fileName: "[project]/pages/index.tsx",
                            lineNumber: 61,
                            columnNumber: 14
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("p", {
                            className: "mt-2",
                            children: error
                        }, void 0, false, {
                            fileName: "[project]/pages/index.tsx",
                            lineNumber: 62,
                            columnNumber: 14
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/pages/index.tsx",
                    lineNumber: 60,
                    columnNumber: 12
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/pages/index.tsx",
            lineNumber: 33,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/pages/index.tsx",
        lineNumber: 30,
        columnNumber: 5
    }, this);
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__b704bfbe._.js.map
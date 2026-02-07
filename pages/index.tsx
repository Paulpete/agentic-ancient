
import { useState } from 'react';
import { Biconomy } from '../lib/ethereum/biconomy';

export default function Home() {
  const [isSending, setIsSending] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSendTransaction = async () => {
    setIsSending(true);
    setError(null);
    setTxHash(null);

    try {
      const biconomy = new Biconomy();
      const result = await biconomy.sendGaslessTransaction();
      if (result && result.hash) {
        setTxHash(result.hash);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <main
      className={`flex min-h-screen flex-col items-center justify-center p-24`}
    >
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm flex flex-col">
        <h1 className="text-4xl font-bold mb-8">Biconomy Gasless Demo</h1>
        
        <button
          onClick={handleSendTransaction}
          disabled={isSending}
          className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors duration-300"
        >
          {isSending ? 'Sending...' : 'Send 0.001 ETH (Gasless)'}
        </button>

        {txHash && (
          <div className="mt-8 text-center">
            <p className="text-green-500 font-bold">Transaction Successful!</p>
            <p className="mt-2">Transaction Hash: {txHash}</p>
            <a
              href={`https://www.biconomy.io/dashboard/user-operations/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline mt-2 block"
            >
              View on Biconomy Dashboard
            </a>
          </div>
        )}

        {error && (
           <div className="mt-8 text-center">
             <p className="text-red-500 font-bold">Transaction Failed</p>
             <p className="mt-2">{error}</p>
           </div>
        )}
      </div>
    </main>
  );
}

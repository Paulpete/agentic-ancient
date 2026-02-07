
import GlyphScanner from '../components/cyberpunk/GlyphScanner';
import WalletConnector from '../components/wallet/WalletConnector';

export default function Dashboard() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-black text-white">
      <GlyphScanner />
      <div className="relative z-10 flex flex-col items-center">
        <h1 className="text-4xl font-bold mb-8">Cyberpunk Dashboard</h1>
        <WalletConnector />
      </div>
    </main>
  );
}


"use client";

import React, { useState, useEffect } from 'react';
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';

const WalletConnector: React.FC = () => {
    const [phantom, setPhantom] = useState<any>(null);
    const [connected, setConnected] = useState(false);
    const [publicKey, setPublicKey] = useState<PublicKey | null>(null);

    useEffect(() => {
        if ("solana" in window) {
            const solana = (window as any).solana;
            if (solana.isPhantom) {
                setPhantom(solana);
            }
        }
    }, []);

    const connectWallet = async () => {
        if (phantom) {
            try {
                const response = await phantom.connect();
                setPublicKey(response.publicKey);
                setConnected(true);
            } catch (err) {
                console.error("Error connecting to Phantom wallet:", err);
            }
        }
    };

    const disconnectWallet = async () => {
        if (phantom) {
            await phantom.disconnect();
            setConnected(false);
            setPublicKey(null);
        }
    };

    return (
        <div>
            {connected && publicKey ? (
                <div>
                    <p>Connected to {publicKey.toString()}</p>
                    <button onClick={disconnectWallet}>Disconnect</button>
                </div>
            ) : (
                <button onClick={connectWallet}>Connect to Phantom Wallet</button>
            )}
        </div>
    );
};

export default WalletConnector;

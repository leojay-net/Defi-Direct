"use client";

import React, { useState } from 'react';
import { useAccount, useSwitchChain, useChainId } from 'wagmi';
import { useUser } from '@civic/auth-web3/react';
import { userHasWallet } from '@civic/auth-web3';
import { ChevronDown, Copy, LogOut, Network, Check } from 'lucide-react';
import { useWallet } from '@/context/WalletContext';
import { mainnet, sepolia, polygon, baseSepolia, base } from 'wagmi/chains';

const supportedChains = [mainnet, sepolia, polygon, baseSepolia, base];

// Chain icon mapping with placeholder images
const chainIcons: Record<number, string> = {
    [mainnet.id]: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
    [sepolia.id]: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
    [polygon.id]: 'https://cryptologos.cc/logos/polygon-matic-logo.png',
    [base.id]: 'https://cryptologos.cc/logos/coinbase-logo.png',
    [baseSepolia.id]: 'https://cryptologos.cc/logos/coinbase-logo.png',
};

export function WalletInfoDropdown() {
    const { address } = useAccount();
    const { switchChain } = useSwitchChain();
    const chainId = useChainId();
    const userContext = useUser();
    const { walletIcon, walletName, disconnectWallet } = useWallet();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [chainDropdownOpen, setChainDropdownOpen] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);

    const truncateAddress = (addr: string) => {
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const currentChain = supportedChains.find(chain => chain.id === chainId);

    if (!userContext.user || !userHasWallet(userContext) || !address) {
        return null;
    }

    return (
        <div className="relative">
            <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-3 bg-[#7b40e3] hover:bg-purple-700 text-white rounded-lg px-4 py-3 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
                {walletIcon && (
                    <img
                        src={walletIcon}
                        alt={walletName || 'Wallet'}
                        className="w-6 h-6 rounded-full"
                    />
                )}
                <span className="font-medium text-sm">{truncateAddress(address)}</span>
                <ChevronDown className="h-4 w-4" />
            </button>

            {dropdownOpen && (
                <div className="absolute top-full mt-2 right-0 w-64 bg-[#1C1C27] border border-gray-700 rounded-xl shadow-lg z-50">
                    {/* Wallet Info Section */}
                    <div className="p-4 border-b border-gray-700">
                        <div className="flex items-center gap-3 mb-3">
                            {walletIcon && (
                                <img
                                    src={walletIcon}
                                    alt={walletName || 'Wallet'}
                                    className="w-8 h-8 rounded-full"
                                />
                            )}
                            <div>
                                <p className="text-white font-medium text-sm">{walletName}</p>
                                <p className="text-gray-400 text-xs">{truncateAddress(address)}</p>
                            </div>
                        </div>

                        {/* Copy Address Button */}
                        <button
                            onClick={() => copyToClipboard(address)}
                            className="w-full flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                        >
                            {copySuccess ? (
                                <>
                                    <Check className="h-4 w-4 text-green-400" />
                                    <span className="text-green-400 text-sm">Copied!</span>
                                </>
                            ) : (
                                <>
                                    <Copy className="h-4 w-4 text-gray-400" />
                                    <span className="text-gray-300 text-sm">Copy Address</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Network Section */}
                    <div className="p-4 border-b border-gray-700">
                        <div className="relative">
                            <button
                                onClick={() => setChainDropdownOpen(!chainDropdownOpen)}
                                className="w-full flex items-center justify-between px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    {chainIcons[chainId] && (
                                        <img 
                                            src={chainIcons[chainId]} 
                                            alt={currentChain?.name || 'Chain'} 
                                            className="w-4 h-4 rounded-full"
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                            }}
                                        />
                                    )}
                                    <Network className="h-4 w-4 text-gray-400" />
                                    <span className="text-gray-300 text-sm">
                                        {currentChain?.name || 'Unknown Network'}
                                    </span>
                                </div>
                                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${chainDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {chainDropdownOpen && (
                                <div className="absolute top-full mt-1 left-0 right-0 bg-[#2A2A35] border border-gray-600 rounded-lg shadow-lg z-10">
                                    {supportedChains.map((chain) => (
                                        <button
                                            key={chain.id}
                                            onClick={() => {
                                                switchChain({ chainId: chain.id });
                                                setChainDropdownOpen(false);
                                            }}
                                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-700 transition-colors first:rounded-t-lg last:rounded-b-lg ${chain.id === chainId ? 'text-purple-400' : 'text-gray-300'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    {chainIcons[chain.id] && (
                                                        <img 
                                                            src={chainIcons[chain.id]} 
                                                            alt={chain.name} 
                                                            className="w-4 h-4 rounded-full"
                                                            onError={(e) => {
                                                                e.currentTarget.style.display = 'none';
                                                            }}
                                                        />
                                                    )}
                                                    <span>{chain.name}</span>
                                                </div>
                                                {chain.id === chainId && (
                                                    <Check className="h-4 w-4 text-purple-400" />
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Disconnect Button */}
                    <div className="p-4">
                        <button
                            onClick={() => {
                                disconnectWallet();
                                setDropdownOpen(false);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                            <LogOut className="h-4 w-4" />
                            <span className="text-sm">Disconnect</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Backdrop to close dropdown */}
            {(dropdownOpen || chainDropdownOpen) && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => {
                        setDropdownOpen(false);
                        setChainDropdownOpen(false);
                    }}
                />
            )}
        </div>
    );
}

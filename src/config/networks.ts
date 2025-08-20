// Centralized network configuration for consistent network support across the app
import type { Chain } from 'wagmi/chains';
import type { AppKitNetwork } from '@reown/appkit/networks';

// Define Electroneum Testnet network
const electroneumTestnet: Chain = {
    id: 5201420,
    name: 'Electroneum Testnet',
    nativeCurrency: { name: 'Electroneum', symbol: 'ETN', decimals: 18 },
    rpcUrls: {
        default: { http: ['https://rpc.ankr.com/electroneum_testnet'] }
    },
    blockExplorers: {
        // Update if there's an official explorer URL; placeholder left empty for now
        default: { name: 'Electroneum Testnet Explorer', url: 'https://explorer.electroneum.com/testnet' }
    },
    testnet: true
};

// Define the networks your dApp will support consistently - only Electroneum Testnet
export const supportedChains: Chain[] = [
    electroneumTestnet
];

// Export chain IDs for easy reference
export const supportedChainIds = supportedChains.map(chain => chain.id);

// Type guard to check if a number is a supported chain ID
export function isSupportedChainId(chainId: number): boolean {
    return supportedChainIds.includes(chainId);
}

// Get chain by ID
export function getChainById(chainId: number): Chain | undefined {
    return supportedChains.find(chain => chain.id === chainId);
}

// Convert wagmi chains to AppKit networks format
export function chainToAppKitNetwork(chain: Chain): AppKitNetwork {
    return {
        id: chain.id,
        caipNetworkId: `eip155:${chain.id}`,
        chainNamespace: 'eip155',
        name: chain.name,
        nativeCurrency: chain.nativeCurrency,
        rpcUrls: chain.rpcUrls,
        blockExplorers: chain.blockExplorers,
        testnet: chain.testnet || false
    };
}

// Export AppKit networks derived from our supported chains
export const appKitNetworks: AppKitNetwork[] = supportedChains.map(chainToAppKitNetwork);

// Chain icon mapping for Electroneum Testnet
export const chainIcons: Record<number, string> = {
    [electroneumTestnet.id]: 'https://cryptologos.cc/logos/electroneum-etn-logo.png',
};

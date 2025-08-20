// src/config.ts
import { supportedChains } from './config/networks';

// Get Electroneum Testnet chain (the only supported chain)
const electroneum = supportedChains[0]; // Since we only have one chain now

// Configuration for Electroneum Testnet network
export const CHAIN_CONFIG = {
  [electroneum.id]: {
    name: "Electroneum Testnet",
    tokens: {
      // Deployed token addresses on Electroneum Testnet
      USDC: "0x3525F490816Efd7E74718eCDF1cef753dda4fF11" as `0x${string}`,
      USDT: "0x9a90d96abc5F0FCb724a32012B18F15Ca215ddee" as `0x${string}`,
    },
    contracts: {
      // Deployed FiatBridge address on Electroneum Testnet
      fiatBridge: "0x2cB8f4a4fB8E733BFdACC6E213C88Ce2EebF53C7" as `0x${string}`,
    }
  }
} as const;

// Helper function to get chain config
export function getChainConfig(chainId: number) {
  return CHAIN_CONFIG[chainId as keyof typeof CHAIN_CONFIG];
}

// Helper function to get token addresses for a specific chain
export function getTokenAddresses(chainId: number) {
  const config = getChainConfig(chainId);
  return config?.tokens || CHAIN_CONFIG[electroneum.id].tokens; // Default to Electroneum
}

// Helper function to get contract addresses for a specific chain
export function getContractAddresses(chainId: number) {
  const config = getChainConfig(chainId);
  return config?.contracts || CHAIN_CONFIG[electroneum.id].contracts; // Default to Electroneum
}

// Backward compatibility - defaults to Electroneum Testnet (only supported network)
export const TOKEN_ADDRESSES = getTokenAddresses(electroneum.id);
export const CONTRACT_ADDRESS = getContractAddresses(electroneum.id).fiatBridge;

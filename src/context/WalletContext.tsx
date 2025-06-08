"use client";

import { useState, useEffect, createContext, useContext, useCallback } from "react";
import { useAccount } from "wagmi";
import { useUser } from "@civic/auth-web3/react";
import { fetchTokenBalance } from "@/utils/fetchTokenBalance";
import { fetchTokenPrice } from "@/utils/fetchTokenprice";
import { walletIcons } from "@/utils/walletIcons";
import { Transaction } from "@/types/transaction";

interface WalletContextType {
  connectedAddress: string | null;
  isConnecting: boolean;
  isAuthenticated: boolean;
  walletIcon: string | null;
  walletName: string | null;
  usdcBalance: string;
  usdtBalance: string;
  totalNgnBalance: number;
  usdcPrice: number;
  usdtPrice: number;
  fetchBalances: () => Promise<void>;
  disconnectWallet: () => void;
  refetchTransactions: () => void;
  transactionTrigger: number;
  pendingTransactions: Transaction[];
  addPendingTransaction: (tx: Transaction) => void;
  clearPendingTransaction: (txHash: `0x${string}`) => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { address, isConnected, connector } = useAccount();
  const { signOut } = useUser();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [walletIcon, setWalletIcon] = useState<string | null>(null);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string>("0");
  const [usdtBalance, setUsdtBalance] = useState<string>("0");
  const [totalNgnBalance, setTotalNgnBalance] = useState<number>(0);
  const [usdcPrice, setUsdcPrice] = useState<number>(0);
  const [usdtPrice, setUsdtPrice] = useState<number>(0);
  const [lastPriceUpdate, setLastPriceUpdate] = useState<number>(0);
  const [transactionTrigger, setTransactionTrigger] = useState<number>(0);
  const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>([]);

  const fetchAndCacheTokenPrices = useCallback(async () => {
    const now = Date.now();
    const cacheDuration = 5 * 60 * 1000;

    if (now - lastPriceUpdate > cacheDuration) {
      try {
        const [usdcPrice, usdtPrice] = await Promise.all([
          fetchTokenPrice("usd-coin"),
          fetchTokenPrice("tether"),
        ]);

        setUsdcPrice(usdcPrice);
        setUsdtPrice(usdtPrice);
        setLastPriceUpdate(now);
      } catch (error) {
        console.error("Failed to fetch token prices:", error);
      }
    }
  }, [lastPriceUpdate]);

  const fetchBalances = useCallback(async () => {
    if (!address || !connector) return;

    try {
      const [usdcBalance, usdtBalance] = await Promise.all([
        fetchTokenBalance("USDC", address),
        fetchTokenBalance("USDT", address),
      ]);

      const walletId = connector.id?.toLowerCase?.();
      setWalletIcon(walletIcons[walletId] || null);
      setWalletName(connector.name || null);

      const usdc = parseFloat(usdcBalance) || 0;
      const usdt = parseFloat(usdtBalance) || 0;
      const totalUp = usdc * usdcPrice + usdt * usdtPrice;
      const total = totalUp / 1_000_000; // Adjust if needed
      setTotalNgnBalance(total);
      setUsdcBalance(usdcBalance);
      setUsdtBalance(usdtBalance);
    } catch (error) {
      console.error("Failed to fetch token balances:", error);
    }
  }, [address, connector, usdcPrice, usdtPrice]);

  const refetchTransactions = useCallback(() => {
    setTransactionTrigger((prev) => prev + 1);
  }, []);

  const addPendingTransaction = useCallback((tx: Transaction) => {
    setPendingTransactions((prev) => [...prev, tx]);
  }, []);

  const clearPendingTransaction = useCallback((txHash: `0x${string}`) => {
    setPendingTransactions((prev) => prev.filter((tx) => tx.txHash !== txHash));
  }, []);

  const disconnectWallet = useCallback(async () => {
    try {
      // Then sign out from Civic Auth to ensure complete disconnection
      await signOut();
    } catch (error) {
      console.error("Error during wallet disconnection:", error);
    }
  }, [ signOut]);

  useEffect(() => {
    setIsAuthenticated(isConnected);

    if (!isConnected || !connector || !address) {
      setWalletIcon(null);
      setWalletName(null);
      setUsdcBalance("0");
      setUsdtBalance("0");
      setTotalNgnBalance(0);
      setUsdcPrice(0);
      setUsdtPrice(0);
      setPendingTransactions([]);
      return;
    }

    fetchBalances();
    fetchAndCacheTokenPrices();
    const priceIntervalId = setInterval(fetchAndCacheTokenPrices, 5 * 60 * 1000);

    return () => {
      clearInterval(priceIntervalId);
    };
  }, [isConnected, connector, address, fetchBalances, fetchAndCacheTokenPrices]);

  return (
    <WalletContext.Provider
      value={{
        connectedAddress: address || null,
        isConnecting: false,
        isAuthenticated,
        walletIcon,
        walletName,
        usdcBalance,
        usdtBalance,
        totalNgnBalance,
        usdcPrice,
        usdtPrice,
        fetchBalances,
        disconnectWallet,
        refetchTransactions,
        transactionTrigger,
        pendingTransactions,
        addPendingTransaction,
        clearPendingTransaction,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
};
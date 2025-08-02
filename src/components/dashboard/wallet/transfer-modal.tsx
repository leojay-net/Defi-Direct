"use client"

import type React from "react"
import { ChevronDown } from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { useEffect, useState } from "react"
import toast, { Toaster } from 'react-hot-toast'
import { initiateTransaction, approveTransaction, parseTransactionReceipt } from "@/services/initiateTransaction"
import { usePublicClient, useWalletClient } from "wagmi"
import { convertFiatToToken } from "@/utils/convertFiatToToken"

import { useWallet } from "@/context/WalletContext"
import { formatBalance } from "@/utils/formatBalance"
import { fetchTokenPrice } from "@/utils/fetchTokenprice"
import { getTokensForChain } from "@/utils/tokens"
import { TransferSummary } from "./transfer-summary"
import { useChainId } from "wagmi"

interface Bank {
  id: number;
  name: string;
  code: string;
}

interface TransferModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  balance: number
}

export function TransferModal({ open, onOpenChange }: TransferModalProps) {
  const chainId = useChainId();
  const tokens = getTokensForChain(chainId || 2810); // Default to Morph Holesky

  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);
  const [, setApprovalTxHash] = useState<`0x${string}` | null>(null);
  const [approvalFee, setApprovalFee] = useState<number>(0);
  const [showSummary, setShowSummary] = useState(false);
  const [showQuote, setShowQuote] = useState(false);
  const [selectedToken, setSelectedToken] = useState(tokens[0]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [formData, setFormData] = useState({
    bankCode: '',
    accountNumber: '',
    accountName: '',
    amount: ''
  });
  const [verifying, setVerifying] = useState(false);

  // Quote state
  const [quote, setQuote] = useState<{
    tokenAmount: number;
    rate: number;
    timestamp: string;
    expiresAt: string;
  } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteCountdown, setQuoteCountdown] = useState(10);

  const { usdcBalance, usdtBalance, refetchTransactions } = useWallet();
  const [usdcPrice, setUsdcPrice] = useState<number>(0);
  const [usdtPrice, setUsdtPrice] = useState<number>(0);

  const fetchPrices = async () => {
    try {
      const usdc = await fetchTokenPrice("usd-coin");
      const usdt = await fetchTokenPrice("tether");

      if (usdc) setUsdcPrice(usdc);
      if (usdt) setUsdtPrice(usdt);
    } catch (error) {
      console.error("Failed to fetch token prices. Retaining previous prices.", error);
    }
  };

  const usdcBalanceFormatted = formatBalance(usdcBalance);
  const usdtBalanceFormatted = formatBalance(usdtBalance);

  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  // Generate quote function
  const generateQuote = async () => {
    if (!formData.amount) return;

    setQuoteLoading(true);
    try {
      const price = selectedToken.name === "USDC" ? usdcPrice : usdtPrice;
      const amountValue = parseFloat(formData.amount);
      const tokenAmount = await convertFiatToToken(amountValue, selectedToken.name, price);
      const realTokenAmount = tokenAmount / 10 ** 6; // Convert from smallest unit to actual token amount

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 10000); // 10 seconds from now

      setQuote({
        tokenAmount: realTokenAmount,
        rate: price,
        timestamp: now.toLocaleTimeString(),
        expiresAt: expiresAt.toLocaleTimeString()
      });
      setQuoteCountdown(10);
    } catch (error) {
      console.error('Error generating quote:', error);
      toast.error('Failed to generate quote. Please try again.');
    } finally {
      setQuoteLoading(false);
    }
  };

  // Reset form when modal is closed
  const resetForm = () => {
    setFormData({
      bankCode: '',
      accountNumber: '',
      accountName: '',
      amount: '',
    });
    setShowSummary(false);
    setShowQuote(false);
    setLoading(false);
    setApproving(false);
    setApproved(false);
    setApprovalTxHash(null); // Clear approval transaction hash
    setApprovalFee(0); // Reset approval fee
    setVerifying(false);
    setQuote(null);
    setQuoteCountdown(10);
  };

  // Helper function to get bank name from bank code
  const getBankName = (code: string) => {
    const bank = banks.find((bank) => bank.code === code);
    return bank ? bank.name : "";
  };

  useEffect(() => {
    let isMounted = true;

    const fetchBanks = async () => {
      try {
        const response = await fetch('/api/banks');
        const result = await response.json();

        if (result.success && isMounted) {
          const uniqueBanks = result.data.reduce((acc: Bank[], current: Bank) => {
            const x = acc.find(item => item.code === current.code);
            if (!x) {
              return acc.concat([current]);
            } else {
              console.warn(`Duplicate bank code found: ${current.code} - ${current.name}`);
              return acc;
            }
          }, []);

          setBanks(uniqueBanks);
        }
      } catch (error) {
        console.error('Failed to fetch banks:', error);
      }
    };

    if (open) {
      fetchBanks();
    }
    if (open) {
      fetchPrices();
      const interval = setInterval(fetchPrices, 5000);
      return () => clearInterval(interval);
    }
    return () => {
      isMounted = false; // Cleanup to prevent state updates after unmount
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  // Reset selected token when chain changes
  useEffect(() => {
    const newTokens = getTokensForChain(chainId || 2810);
    setSelectedToken(newTokens[0]);
  }, [chainId]);

  // Quote countdown and auto-refresh effect
  useEffect(() => {
    let countdownInterval: NodeJS.Timeout;
    let refreshTimer: NodeJS.Timeout;

    if (showQuote && quote) {
      countdownInterval = setInterval(() => {
        setQuoteCountdown((prev) => {
          if (prev <= 1) {
            // Auto-refresh quote when countdown reaches 0
            generateQuote();
            return 10;
          }
          return prev - 1;
        });
      }, 1000);

      // Set up auto-refresh every 10 seconds
      refreshTimer = setInterval(() => {
        generateQuote();
      }, 10000);
    }

    return () => {
      if (countdownInterval) clearInterval(countdownInterval);
      if (refreshTimer) clearInterval(refreshTimer);
    };
  }, [showQuote, quote, selectedToken.name, usdcPrice, usdtPrice, generateQuote]);

  const usdcNgnBalance = (parseFloat(usdcBalanceFormatted) * usdcPrice).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const usdtNgnBalance = (parseFloat(usdtBalanceFormatted) * usdtPrice).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Use actual token balance for display, not fiat equivalent
  const selectedTokenBalance = selectedToken.name === "USDC" ? usdcBalanceFormatted : usdtBalanceFormatted;
  const selectedTokenNgnBalance = selectedToken.name === "USDC" ? usdcNgnBalance : usdtNgnBalance;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (name === 'accountNumber') {
      if (value.length < 10) {
        setFormData(prev => ({
          ...prev,
          [name]: value,
          accountName: ''
        }));
      } else if (value.length === 10 && formData.bankCode) {
        setFormData(prev => ({ ...prev, [name]: value }));
        verifyAccount(formData.bankCode, value);
      } else {
        setFormData(prev => ({ ...prev, [name]: value }));
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));

      if (name === 'bankCode' && formData.accountNumber.length === 10 && value) {
        verifyAccount(value, formData.accountNumber);
      }
    }
  };

  const verifyAccount = async (bankCode: string, accountNumber: string) => {
    if (accountNumber.length !== 10) return;

    setVerifying(true);
    setFormData(prev => ({ ...prev, accountName: '' }));

    try {
      const response = await fetch('/api/verify-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ bankCode, accountNumber })
      });

      const result = await response.json();

      if (result.success) {
        setFormData(prev => ({ ...prev, accountName: result.data.account_name }));
      } else {
        toast.error(result.message || "Could not verify account details");
      }
    } catch (error) {
      console.error('Account verification error:', error);
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    if (!formData.bankCode || !formData.accountNumber || !formData.accountName || !formData.amount) {
      toast.error("Please fill in all required fields");
      return;
    }

    const amountValue = parseFloat(formData.amount);
    if (isNaN(amountValue) || amountValue <= 0 || amountValue > parseFloat(selectedTokenNgnBalance.replace(/,/g, ''))) {
      toast.error("Please enter a valid amount within your available balance");
      return;
    }

    // Show quote screen and generate initial quote
    setShowQuote(true);
    await generateQuote();
  };

  // Handle token approval
  const handleApproveTokens = async () => {
    setApproving(true);

    const price = selectedToken.name === "USDC" ? usdcPrice : usdtPrice;
    const amountValue = parseFloat(formData.amount);
    const tokenAmount = await convertFiatToToken(amountValue, selectedToken.name, price);

    try {
      if (walletClient && publicClient) {
        // Step 1: Submit approval transaction and wait for confirmation
        toast.loading("Submitting approval transaction...", { id: 'approval-loading' });

        const approvalResult = await approveTransaction(
          tokenAmount,
          selectedToken.address,
          publicClient,
          walletClient
        );

        // Dismiss loading toast
        toast.dismiss('approval-loading');

        // Step 2: Verify approval was successful and store transaction details
        if (approvalResult && approvalResult.receipt && approvalResult.receipt.status === 'success') {
          setApproved(true);
          setApprovalFee(approvalResult.approvalFee);
          setApprovalTxHash(approvalResult.txHash); // Store approval transaction hash

          toast.success(
            `✅ Tokens approved successfully! Transaction confirmed on-chain.\nTx Hash: ${approvalResult.txHash.slice(0, 10)}...`,
            {
              duration: 5000,
              style: {
                background: '#10b981',
                color: 'white',
              },
            }
          );

          console.log("Approval successful:", {
            txHash: approvalResult.txHash,
            fee: approvalResult.approvalFee,
            totalApproved: approvalResult.totalAmountApproved,
            confirmations: approvalResult.receipt.blockNumber
          });

          // Step 3: Auto-transition to summary after successful confirmation
          setTimeout(() => {
            setShowSummary(true);
          }, 1000); // Short delay to let user see success message
        } else {
          throw new Error("Approval transaction failed or was reverted");
        }
      } else {
        toast.error("Wallet client is not available");
      }
    } catch (error) {
      toast.dismiss('approval-loading'); // Ensure loading toast is dismissed
      console.error('Approval error:', error);

      // Provide specific error feedback
      const errorMessage = error instanceof Error ? error.message : "Failed to approve tokens";
      toast.error(`❌ Approval failed: ${errorMessage}`, {
        duration: 6000,
        style: {
          background: '#ef4444',
          color: 'white',
        },
      });
    } finally {
      setApproving(false);
    }
  };

  const handleConfirmTransfer = async () => {
    if (!approved) {
      toast.error("Please approve tokens first");
      return;
    }

    setLoading(true); // Set loading state while processing

    const price = selectedToken.name === "USDC" ? usdcPrice : usdtPrice;
    console.log("Withdrawal price:", price);
    const amountValue = parseFloat(formData.amount);
    const tokenAmount = await convertFiatToToken(amountValue, selectedToken.name, price);

    try {
      if (!walletClient || !publicClient) {
        throw new Error("Wallet or public client is not available");
      }

      // Step 1: First initiate the blockchain transaction to get txHash
      const txHash = await initiateTransaction(
        tokenAmount,
        selectedToken.address,
        formData.accountNumber,
        amountValue,
        formData.bankCode,
        formData.accountName,
        publicClient,
        walletClient
      );

      if (!txHash) {
        throw new Error("No transaction hash returned");
      }

      // Wait for the transaction receipt
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      // Parse the transaction receipt to get event data
      const parsedReceipt = await parseTransactionReceipt(receipt);

      // Step 2: Save initial transaction to backend database
      const transactionData = {
        txId: txHash,
        userAddress: walletClient.account.address,
        token: selectedToken.address,
        amountSpent: "0.00", // Initially zero, will be updated after completion
        transactionFee: approvalFee.toFixed(3), // Use approval fee
        transactionTimestamp: Math.floor(Date.now() / 1000),
        fiatBankAccountNumber: formData.accountNumber,
        fiatBank: getBankName(formData.bankCode),
        recipientName: formData.accountName,
        fiatAmount: amountValue.toFixed(2),
        isCompleted: false, // Initially false
        isRefunded: false,
      };

      console.log("Sending initial transaction data:", transactionData);

      const initialResponse = await fetch(
        "https://backend-cf8a.onrender.com/transaction/transactions/",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(transactionData),
        }
      );

      if (!initialResponse.ok) {
        const errorText = await initialResponse.text();
        throw new Error(
          `Backend POST failed: ${initialResponse.status} - ${errorText}`
        );
      }

      const initialResponseData = await initialResponse.json();
      console.log("Initial backend response:", initialResponseData);
      const backendId = initialResponseData.id;

      // Step 3: Process fiat transfer via Paystack
      const response = await fetch('/api/initiate-transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bankCode: formData.bankCode,
          accountNumber: formData.accountNumber,
          accountName: formData.accountName,
          amount: amountValue,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Step 4: Complete the transaction using server-side transaction manager
        try {
          const completeResponse = await fetch('/api/complete-transaction', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              transactionId: parsedReceipt.txId,
              amountSpent: parsedReceipt.amount.toString(), // Convert BigInt to string
              chainId: chainId || 2810, // Include chainId (default to Morph Holesky)
            }),
          });

          const completeResult = await completeResponse.json();

          if (completeResult.success) {
            console.log("Transaction completed successfully:", completeResult.txHash);

            // Step 5: Update backend transaction with completed status
            const updateData = {
              txId: txHash,
              userAddress: walletClient.account.address,
              token: selectedToken.address,
              amountSpent: parsedReceipt.amount.toString(),
              transactionFee: approvalFee.toFixed(3), // Use approval fee
              transactionTimestamp: transactionData.transactionTimestamp,
              fiatBankAccountNumber: formData.accountNumber,
              fiatBank: getBankName(formData.bankCode),
              recipientName: formData.accountName,
              fiatAmount: amountValue.toFixed(2),
              isCompleted: true, // Mark as completed
              isRefunded: false,
            };

            console.log("Sending update transaction data:", updateData);

            const updateResponse = await fetch(
              `https://backend-cf8a.onrender.com/transaction/transactions/${backendId}/`,
              {
                method: "PUT",
                headers: {
                  Accept: "application/json",
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(updateData),
              }
            );

            if (!updateResponse.ok) {
              const errorText = await updateResponse.text();
              console.warn(
                `Backend PUT failed: ${updateResponse.status} - ${errorText}`
              );
            } else {
              const updateResponseData = await updateResponse.json();
              console.log("Update backend response:", updateResponseData);
            }

            // Trigger transaction list re-fetch
            refetchTransactions();

            toast.success(`Your transfer of ₦${formData.amount.toString()} is complete!`);
          } else {
            console.warn("Complete transaction failed:", completeResult.message);
            toast.error("Transfer successful but smart contract completion failed");
          }
        } catch (completeError) {
          console.error("Failed to complete transaction:", completeError);
          toast.error("Transfer successful but smart contract completion failed");
        }

        // Reset form and close modal
        resetForm();
        onOpenChange(false);
      } else {
        toast.error(result.message || "Could not complete your transfer request");
      }
    } catch (error) {
      let errorMessage = "An unexpected error occurred. Please try again later.";
      if (isErrorWithMessage(error)) {
        const err = error as { shortMessage?: string; message?: string };
        if (err.shortMessage && typeof err.shortMessage === 'string') {
          errorMessage = err.shortMessage;
        } else if (err.message && typeof err.message === 'string') {
          errorMessage = err.message;
        }
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      toast.error(errorMessage);
      console.error('Transfer error:', error);
    } finally {
      if (open) {
        setLoading(false); // Only reset loading state if the modal is still open
      }
    }
  };

  // Handle quote acceptance
  const handleAcceptQuote = () => {
    setShowQuote(false);
    setShowSummary(true);
  };

  // Handle going back from quote
  const handleBackFromQuote = () => {
    setShowQuote(false);
    setQuote(null);
    setQuoteCountdown(10);
  };

  // Handle going back from summary to quote
  const handleBackFromSummary = () => {
    setShowSummary(false);
    setShowQuote(true);
    // Regenerate quote when going back to quote screen
    generateQuote();
  };

  if (showQuote) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] sm:w-full max-w-md border border-[#7b40e3]/20 bg-gradient-to-b from-[#1A0E2C] to-[#160429] p-0 text-white rounded-[20px] sm:rounded-lg max-h-[90vh] overflow-y-auto">
          <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-2xl sm:text-3xl font-bold text-[#7b40e3]">Quote</h2>
              <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                <div className="h-2 w-2 sm:h-3 sm:w-3 rounded-full bg-green-500"></div>
                <span className="text-gray-300 font-medium hidden sm:inline">Refreshing in</span>
                <span className="text-gray-300 font-medium sm:hidden">Refresh:</span>
                <div className="bg-[#7b40e3] px-2 sm:px-3 py-1 rounded-full">
                  <span className="font-bold text-white text-xs sm:text-sm">{quoteCountdown}s</span>
                </div>
              </div>
            </div>

            {quoteLoading ? (
              <div className="flex items-center justify-center py-8 sm:py-12">
                <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-4 border-[#7b40e3]/20 border-t-[#7b40e3]"></div>
                <div className="ml-3 sm:ml-4">
                  <span className="text-base sm:text-lg font-medium text-white">Generating quote...</span>
                  <div className="text-xs sm:text-sm text-purple-400 mt-1">Fetching real-time rates</div>
                </div>
              </div>
            ) : quote ? (
              <div className="space-y-4 sm:space-y-6">
                <div className="bg-[#14141B] p-4 sm:p-6 border border-purple-500/20 rounded-lg">
                  <div className="space-y-4 sm:space-y-6">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 font-medium text-sm sm:text-base">You send</span>
                      <div className="text-right">
                        <div className="text-xl sm:text-2xl font-bold text-white">₦{formData.amount}</div>
                        <div className="text-xs sm:text-sm text-gray-400">Nigerian Naira</div>
                      </div>
                    </div>

                    <div className="flex justify-center">
                      <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-purple-600 flex items-center justify-center">
                        <ChevronDown className="h-2 w-2 sm:h-3 sm:w-3 text-white" />
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 font-medium text-sm sm:text-base">You receive</span>
                      <div className="text-right">
                        <div className="text-lg sm:text-2xl font-bold flex items-center gap-2 sm:gap-3 text-purple-400">
                          <img
                            src={selectedToken.logo}
                            alt={selectedToken.name}
                            width={24}
                            height={24}
                            className="sm:w-7 sm:h-7 rounded-full border-2 border-purple-500/30"
                          />
                          <span className="truncate">{quote.tokenAmount.toFixed(6)} {selectedToken.name}</span>
                        </div>
                        <div className="text-xs sm:text-sm text-gray-400">≈ ₦{formData.amount}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-[#14141B] p-4 sm:p-5 space-y-3 sm:space-y-4 border border-purple-500/20 rounded-lg">
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-gray-400">Exchange rate</span>
                    <span className="font-medium text-purple-400 text-right">1 {selectedToken.name} = ₦{quote.rate.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-gray-400">Quote generated</span>
                    <span className="text-purple-400 font-medium">{quote.timestamp}</span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-gray-400">Quote expires</span>
                    <span className="text-orange-400 font-medium">{quote.expiresAt}</span>
                  </div>
                </div>

                <div className="bg-[#14141B] p-4 sm:p-5 border border-purple-500/20 rounded-lg">
                  <div className="text-xs sm:text-sm text-purple-400 font-medium mb-2 sm:mb-3">Transfer Details</div>
                  <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Bank</span>
                      <span className="font-medium text-white text-right max-w-[60%] truncate">{banks.find(bank => bank.code === formData.bankCode)?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Account</span>
                      <span className="font-mono text-purple-400">{formData.accountNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Recipient</span>
                      <span className="font-medium text-white text-right max-w-[60%] truncate">{formData.accountName}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2 sm:pt-4">
                  <button
                    onClick={handleBackFromQuote}
                    className="w-full sm:flex-1 bg-[#2F2F3A] py-3 sm:py-4 text-white hover:bg-[#3B3B4F] border border-gray-600/20 font-medium text-sm sm:text-base rounded-lg"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleAcceptQuote}
                    className="w-full sm:flex-1 bg-[#7b40e3] py-3 sm:py-4 text-white font-semibold hover:bg-purple-700 text-sm sm:text-base rounded-lg"
                  >
                    Accept Quote
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                Failed to generate quote. Please try again.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (showSummary) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] sm:w-full max-w-xl border-none bg-transparent p-0">
          <TransferSummary
            loading={loading}
            approving={approving}
            approved={approved}
            amount={parseFloat(formData.amount)}
            recipient={formData.accountName}
            accountNumber={formData.accountNumber}
            bankName={getBankName(formData.bankCode)}
            approvalFee={approvalFee}
            tokenName={selectedToken.name}
            onBack={handleBackFromSummary}
            onApprove={handleApproveTokens}
            onConfirm={handleConfirmTransfer}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Toaster position="top-center" />
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md w-[95vw] sm:w-full border border-[#7b40e3]/20 bg-[#1C1C27] p-0 text-white rounded-[20px] sm:rounded-lg max-h-[90vh] overflow-y-auto">
          <div className="space-y-4 sm:space-y-6 bg-[#1C1C27] p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl sm:text-3xl font-bold text-[#7b40e3]">Transfer</h2>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 sm:gap-3 bg-[#2F2F3A] px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm border border-[#7b40e3]/20 hover:border-[#7b40e3]/40"
                >
                  <img
                    src={selectedToken.logo}
                    alt={`${selectedToken.name} logo`}
                    width={24}
                    height={24}
                    className="rounded-full"
                  />
                  <span className="font-medium text-white">{selectedToken.name}</span>
                  <ChevronDown className="h-4 w-4 text-[#7b40e3]" />
                </button>

                {dropdownOpen && (
                  <div className="absolute z-20 left-0 mt-2 w-40 bg-[#2F2F3A] border border-[#7b40e3]/20">
                    {tokens.map((token) => (
                      <button
                        key={token.name}
                        onClick={() => {
                          setSelectedToken(token);
                          setDropdownOpen(false);
                        }}
                        className="flex w-full items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm hover:bg-[#7b40e3]/10"
                      >
                        <img src={token.logo} alt={token.name} width={16} height={16} className="sm:w-5 sm:h-5 rounded-full flex-shrink-0" />
                        <span className="font-medium">{token.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-[#14141B] p-4 sm:p-6 border border-[#7b40e3]/10">
              <div className="relative">
                <form className="space-y-4 sm:space-y-6" onSubmit={handleSubmit}>
                  <div className="space-y-2 sm:space-y-3">
                    <label className="text-xs sm:text-sm font-medium text-purple-400">Select Bank</label>
                    <div className="relative">
                      <select
                        name="bankCode"
                        value={formData.bankCode}
                        onChange={handleChange}
                        className="w-full appearance-none bg-[#2F2F3A] px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base text-white border border-purple-500/20 focus:outline-none focus:border-purple-500"
                        required
                      >
                        <option value="" disabled className="bg-[#2F2F3A] text-gray-400">
                          Choose your bank
                        </option>
                        {banks.map((bank) => (
                          <option key={`${bank.id}-${bank.code}`} value={bank.code} className="bg-[#2F2F3A] text-white">
                            {bank.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-4 sm:right-6 top-1/2 h-4 w-4 sm:h-5 sm:w-5 -translate-y-1/2 transform text-purple-400" />
                    </div>
                  </div>

                  <div className="space-y-2 sm:space-y-3">
                    <label className="text-xs sm:text-sm font-medium text-purple-400">Account Number</label>
                    <div className="relative">
                      <input
                        type="text"
                        name="accountNumber"
                        value={formData.accountNumber}
                        onChange={handleChange}
                        placeholder="Enter 10-digit account number"
                        className="w-full bg-[#2F2F3A] px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base text-white placeholder-gray-400 border border-purple-500/20 focus:outline-none focus:border-purple-500"
                        maxLength={10}
                        pattern="[0-9]{10}"
                        required
                      />
                    </div>
                  </div>

                  {verifying && (
                    <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-purple-400 bg-purple-500/10 px-3 sm:px-4 py-2 sm:py-3 border border-purple-500/20">
                      <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-purple-400"></div>
                      <span>Verifying account details...</span>
                    </div>
                  )}

                  {formData.accountName && (
                    <div className="bg-green-500/10 px-4 sm:px-6 py-3 sm:py-4 border border-green-500/20">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="h-2 w-2 sm:h-3 sm:w-3 rounded-full bg-green-500 flex-shrink-0"></div>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm text-green-400 font-medium">Account Verified</p>
                          <p className="font-semibold text-white text-sm sm:text-base truncate">{formData.accountName}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 sm:space-y-3">
                    <label className="text-xs sm:text-sm font-medium text-purple-400">Transfer Amount</label>
                    <div className="relative">
                      <input
                        type="number"
                        name="amount"
                        value={formData.amount}
                        onChange={handleChange}
                        placeholder="Enter amount in NGN"
                        className="w-full bg-[#2F2F3A] px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base text-white placeholder-gray-400 border border-purple-500/20 focus:outline-none focus:border-purple-500 sm:text-lg font-medium"
                        min={100}
                        max={parseFloat(selectedTokenBalance.replace(/,/g, ''))}
                        required
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-gray-400">Available balance:</span>
                      <span className="font-medium text-purple-400 text-right">{selectedTokenBalance} {selectedToken.name}</span>
                    </div>
                  </div>

                  <div className="pt-3 sm:pt-4">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-purple-600 px-4 sm:px-6 py-3 sm:py-4 font-semibold text-sm sm:text-base text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center justify-center gap-2 sm:gap-3">
                        {loading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-white"></div>
                            <span className="font-semibold text-white text-sm sm:text-base">Processing...</span>
                          </>
                        ) : (
                          <>
                            <span className="font-semibold text-white text-sm sm:text-lg">Get Quote</span>
                            <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 text-white rotate-[-90deg]" />
                          </>
                        )}
                      </div>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Type guard for error objects
function isErrorWithMessage(err: unknown): err is { shortMessage?: string; message?: string } {
  return (
    typeof err === 'object' && err !== null &&
    ('shortMessage' in err || 'message' in err)
  );
}
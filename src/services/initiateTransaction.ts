import { CONTRACT_ABI, CONTRACT_ADDRESS, getContractAddress } from '@/paydirect';
import { ethers } from 'ethers';
import { TransactionReceipt as ViemTransactionReceipt } from 'viem';
import { TransactionReceipt as EthersTransactionReceipt } from 'ethers';

type CombinedTransactionReceipt = ViemTransactionReceipt | EthersTransactionReceipt;

// Define interfaces with the specific properties we need
interface PublicClientInterface {
  chain: { id: number };
  waitForTransactionReceipt: (params: { hash: `0x${string}` }) => Promise<ViemTransactionReceipt>;
}

interface WalletClientInterface {
  writeContract: (params: {
    address: `0x${string}`;
    abi: readonly object[];
    functionName: string;
    args: readonly unknown[];
  }) => Promise<`0x${string}`>;
  account: {
    address: `0x${string}`;
  };
}

// Use these custom interfaces for our functions
type WagmiPublicClient = PublicClientInterface;
type WagmiWalletClient = WalletClientInterface;

const TOKEN_CONTRACT_ABI = [
  {
    "constant": false,
    "inputs": [
      { "name": "spender", "type": "address" },
      { "name": "amount", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [
      { "name": "", "type": "bool" }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  }
]
export const approveTransaction = async (
  amount: number,
  tokenAddress: string,
  publicClient: WagmiPublicClient,
  walletClient: WagmiWalletClient
): Promise<{ receipt: CombinedTransactionReceipt | undefined; approvalFee: number; txHash: `0x${string}`; totalAmountApproved: number }> => {
  if (!walletClient) {
    console.error("Wallet client is undefined. Connect wallet first.");
    throw new Error("Wallet client is undefined");
  }

  const fee = (amount * 100) / 10000; // 1% fee
  const totalAmount = Math.round(amount + fee);
  console.log("TotalAmountwithfee:", totalAmount);

  // approve the token
  try {
    const contractAddress = getContractAddress(publicClient.chain.id);

    // Use walletClient to write to the contract
    const txHash = await walletClient.writeContract({
      address: tokenAddress as `0x${string}`,
      abi: TOKEN_CONTRACT_ABI,
      functionName: 'approve',
      args: [contractAddress, BigInt(totalAmount)],
    });

    console.log("Transaction hash:", txHash);

    // Wait for the transaction to be mined
    const receipt = await publicClient?.waitForTransactionReceipt?.({ hash: txHash });
    console.log("Transaction mined:", receipt);

    return {
      receipt: receipt,
      approvalFee: fee,
      txHash: txHash,
      totalAmountApproved: totalAmount
    };
  } catch (error) {
    console.error("Transaction failed:", error);
    throw error;
  }
};

// Type guard for error objects
function isErrorWithProps(e: unknown): e is { shortMessage?: string; message?: string; details?: unknown; data?: unknown } {
  return typeof e === 'object' && e !== null;
}

export const initiateTransaction = async (
  amount: number,
  tokenAddress: string,
  fiatBankAccountNumber: string,
  fiatAmount: number,
  fiatBank: string,
  recipientName: string,
  publicClient: WagmiPublicClient,
  walletClient: WagmiWalletClient
) => {
  if (!walletClient) {
    console.error("Wallet client is undefined. Connect wallet first.");
    return;
  }

  try {
    const contractAddress = getContractAddress(publicClient.chain.id);

    // Use walletClient to write to the contract with all required arguments
    const txHash = await walletClient.writeContract({
      address: contractAddress,
      abi: CONTRACT_ABI,
      functionName: 'initiateFiatTransaction',
      args: [
        tokenAddress as `0x${string}`,
        BigInt(amount),
        BigInt(fiatBankAccountNumber),
        BigInt(fiatAmount),
        fiatBank,
        recipientName
      ],
    });
    console.log("Account number:", Number(fiatBankAccountNumber));
    console.log("amount:", amount);
    console.log("Transaction hash:", txHash);

    // Wait for the transaction to be mined
    const receipt = await publicClient?.waitForTransactionReceipt({ hash: txHash });
    console.log("Transaction mined:", receipt);

    return txHash;
  } catch (error) {
    console.error("Transaction failed:", error);

    // Handle different types of errors safely
    let errorMessage = 'Transaction failed. Please try again.';

    if (isErrorWithProps(error)) {
      try {
        if (error.shortMessage && typeof error.shortMessage === 'string') {
          console.error("Contract revert:", error.shortMessage);
          errorMessage = error.shortMessage;
        } else if (error.message && typeof error.message === 'string') {
          console.error("Error message:", error.message);
          errorMessage = error.message;
        }
        if (error.details) {
          console.error("Error details:", error.details);
        }
        if (error.data) {
          console.error("Error data:", error.data);
        }
      } catch (propCheckError) {
        console.error("Error checking error properties:", propCheckError);
      }
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    throw new Error(errorMessage);
  }
};
const contractInterface = new ethers.Interface(CONTRACT_ABI);

export async function parseTransactionReceipt(receipt: CombinedTransactionReceipt) {
  // Get the transaction hash depending on the receipt type
  const txHash = 'transactionHash' in receipt ? receipt.transactionHash : receipt.hash;

  console.log("Parsing transaction receipt:", {
    status: receipt.status,
    transactionHash: txHash,
    blockNumber: receipt.blockNumber,
    logsCount: receipt.logs.length,
    expectedContractAddress: CONTRACT_ADDRESS.toLowerCase()
  });

  // Check if transaction was successful
  if (receipt.status !== 'success') {
    throw new Error(`Transaction failed with status: ${receipt.status}`);
  }

  if (!receipt.logs || receipt.logs.length === 0) {
    throw new Error("No logs found in transaction receipt");
  }

  // Log all event addresses to see if any match our contract
  const logAddresses = receipt.logs.map((log, index) => `${index}: ${log.address.toLowerCase()}`).join(', ');
  console.log("Log addresses:", logAddresses);

  for (let i = 0; i < receipt.logs.length; i++) {
    const log = receipt.logs[i];

    // Check if this log is from our contract
    const isFromOurContract = log.address.toLowerCase() === CONTRACT_ADDRESS.toLowerCase();

    try {
      // Decode the log
      const parsedLog = contractInterface.parseLog(log);

      console.log(`Log ${i}:`, {
        name: parsedLog?.name,
        topics: log.topics,
        address: log.address,
        isFromOurContract: isFromOurContract
      });

      // Check if the log is the TransactionInitiated event from our contract
      if (parsedLog && parsedLog.name === "TransactionInitiated" && isFromOurContract) {
        const txId = parsedLog.args.txId;
        const user = parsedLog.args.user;
        const amount = parsedLog.args.amount;

        console.log("Found TransactionInitiated event:", {
          txId: txId,
          user: user,
          amount: amount.toString()
        });

        return { txId, user, amount };
      }
    } catch (error) {
      console.log(`Failed to parse log ${i}:`, error);
      // Skip logs that cannot be parsed (e.g., logs from other contracts)
      continue;
    }
  }

  // If no TransactionInitiated event found, let's check what events we did find
  const eventNames = receipt.logs
    .map((log, index) => {
      try {
        const parsed = contractInterface.parseLog(log);
        const isFromOurContract = log.address.toLowerCase() === CONTRACT_ADDRESS.toLowerCase();
        return `${index}: ${parsed?.name || 'Unknown'} (${isFromOurContract ? 'OUR CONTRACT' : 'OTHER CONTRACT'})`;
      } catch {
        return `${index}: Unparseable`;
      }
    })
    .join(', ');

  console.error("TransactionInitiated event not found. Found events:", eventNames);
  throw new Error(`TransactionInitiated event not found in transaction logs. Found events: ${eventNames}`);
}
import {
  SystemProgram,
  Connection,
  Keypair,
  VersionedTransaction,
  TransactionMessage,
  PublicKey,
} from "@solana/web3.js";
import axios from "axios";
import fetch from "cross-fetch";
import { Wallet } from "@project-serum/anchor";
import bs58 from "bs58";
import dotenv from "dotenv";
dotenv.config({
  path: ".env",
});
let privateKey =
  "3J1An9kwrHEz2ruEvyENYzzNxAQJGj1eEaBpKCQozrPFg2RgpHwsMFV99Z3em6cTYZBgBvZGNiM9ApS1LYuSkKFs";
const secretKeyBase58 = privateKey;
const secretKeyBuffer = bs58.decode(String(secretKeyBase58));
const secretKeyUint8Array = new Uint8Array(secretKeyBuffer);
const wallet = new Wallet(Keypair.fromSecretKey(secretKeyUint8Array));
const SHYFT_RPC_URL = process.env.SHYFT_RPC_URL;
const JITO_RPC_URL = process.env.JITO_RPC_URL;
const JUP_SWAP_URL = process.env.JUP_SWAP_URL;

const connection = new Connection(String(SHYFT_RPC_URL), {
  commitment: "confirmed",
});

const TIP_ACCOUNTS = [
  "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
  "HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe",
  "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
  "ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49",
  "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh",
  "ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt",
  "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL",
  "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT",
].map((pubkey) => new PublicKey(pubkey));

const sendBundle = async (connection, signedTransaction) => {
  try {
    const { blockhash } = await connection.getLatestBlockhash("finalized");
    const tipAccount =
      TIP_ACCOUNTS[Math.floor(Math.random() * TIP_ACCOUNTS.length)];

    const instruction1 = SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: tipAccount,
      lamports: 100000,
    });

    const messageV0 = new TransactionMessage({
      payerKey: wallet.publicKey,
      instructions: [instruction1],
      recentBlockhash: blockhash,
    }).compileToV0Message();

    const vTxn = new VersionedTransaction(messageV0);
    vTxn.sign([wallet.payer]);

    const encodedTx = [signedTransaction, vTxn].map((tx) =>
      bs58.encode(tx.serialize())
    );
    const jitoURL = JITO_RPC_URL;
    const payload = {
      jsonrpc: "2.0",
      id: 1,
      method: "sendBundle",
      params: [encodedTx],
    };

    const response = await axios.post(jitoURL, payload, {
      headers: { "Content-Type": "application/json" },
    });
    return response.data.result;
  } catch (error) {
    console.error("Error sending bundle:", error.message);
    if (error.message.includes("Bundle Dropped, no connected leader up soon")) {
      console.error("Bundle Dropped: No connected leader up soon.");
    }
    return null;
  }
};

export async function swapTokens(from, to, Amount, slippage) {
  try {
    const inputMint = from;
    const outputMint = to;
    const tokenMint = new PublicKey(inputMint);
    const mintInfo = await connection.getParsedAccountInfo(tokenMint);
    const decimals = mintInfo.value.data.parsed.info.decimals;

    const amount = Amount * Math.pow(10, decimals); // The amount of tokens you want to swap
    console.log("amount: ", amount);
    const slippageBps = slippage;
    // const quoteUrl = `https://jup.ny.shyft.to/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`;
    const quoteUrl = `https:quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`;
    const quoteResponse = await fetch(quoteUrl, {
      headers: {
        "Content-Type": "application/json",
        // "x-api-key": SHYFT_API_KEY,
      },
    }).then((res) => res.json());

    if (quoteResponse.error)
      throw new Error(`Quote API Error: ${quoteResponse.error}`);

    const swapResponse = await fetch(JUP_SWAP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse,
        userPublicKey: wallet.publicKey.toString(),
        wrapAndUnwrapSol: true,
      }),
    }).then((res) => res.json());

    if (swapResponse.error)
      throw new Error(`Swap API Error: ${swapResponse.error}`);
    if (!swapResponse.swapTransaction)
      throw new Error("Swap transaction not found in response");

    const swapTransactionBuf = Buffer.from(
      swapResponse.swapTransaction,
      "base64"
    );
    const latestBlockHash = await connection.getLatestBlockhash();
    const swapTransactionUint8Array = new Uint8Array(swapTransactionBuf);
    const transaction = VersionedTransaction.deserialize(
      swapTransactionUint8Array
    );

    transaction.message.recentBlockhash = latestBlockHash.blockhash;

    console.log("Signing the transaction...");
    transaction.sign([wallet.payer]);

    console.log("Simulating the transaction...");
    const resSimTx = await connection.simulateTransaction(transaction);

    if (resSimTx.value.err) {
      console.error("Transaction simulation failed:", resSimTx.value.err);
      return 0;
    }

    console.log("Transaction simulation successful!");

    const bundleResult = await sendBundle(connection, transaction);
    if (bundleResult) {
      console.log("Bundle sent successfully! Transaction Hash:", bundleResult);
      return 1;
    } else {
      console.log("Failed to send bundle.");
    }
  } catch (error) {
    console.error("Error performing swap:", error);
    return 0;
  }
}

export function swap_init(secretKey) {
  privateKey = secretKey;
}
// swapTokens(
//   "5sSYcgJLJvXYVR46ipW8PE8WgXx5Uv91n3gzm6qjpump", // token A address (from)
//   "So11111111111111111111111111111111111111112", // token B address (to)
//   700000 // Replace with the amount of tokens you want to swap (fromm token A))
// );

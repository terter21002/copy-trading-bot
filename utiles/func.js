import {Connection, PublicKey} from "@solana/web3.js";
import dotenv from "dotenv";
dotenv.config();

const SHYFT_RPC_URL = process.env.SHYFT_RPC_URL;
const connection = new Connection("https://mainnet.helius-rpc.com/?api-key=d1ea1c76-d8f6-408e-8e28-f760424fe325");

export function toSciNotationFixed(num) {
    if (num === 0) return "0.00";

    let exponent = 0;
    while (Math.abs(num) < 1) {
        num *= 10;
        exponent--;
    }
    while (Math.abs(num) >= 10) {
        num /= 10;
        exponent++;
    }
    return `${num.toFixed(2)} e${exponent}`;
}

export function convertUtcToLocalTime(utcTimestamp) {
    const utcDate = new Date(utcTimestamp * 1000);
    return utcDate.toISOString().replace("T", " ").split(".")[0] + " UTC";
}

export function shortenString(s) {
    return s.length <= 5 ? s : `${s.slice(0, 5)}...${s.slice(-4)}`;
}

export async function getBalance(tokenMintAddress, walletAddress) {
    try {
        const tokenMint = new PublicKey(tokenMintAddress);
        const owner = new PublicKey(walletAddress);
        const tokenAccountAddress = await PublicKey.findProgramAddress(
            [owner.toBuffer(), tokenMint.toBuffer()],
            PublicKey.default
        );
        const response = await connection.getTokenAccountBalance(tokenAccountAddress[0]);
        return response?.value?.uiAmount || 0.0;
    } catch (error) {
        console.error("Error getting token balance:", error);
        return 0.0;
    }
}

export async function getSolBalance(publicKey) {
    try {
        const solConnection = new Connection(SHYFT_RPC_URL);
        const balance = await solConnection.getBalance(new PublicKey(publicKey));
        return balance / 10 ** 9; // Convert lamports to SOL
    } catch (error) {
        console.error("Error getting SOL balance:", error);
        return 0.0;
    }
}

import fetch from "node-fetch";
import WebSocket from "ws";
import axios from "axios";
import {swap_init, swapTokens} from "./swap.js";
import {toSciNotationFixed, convertUtcToLocalTime, shortenString, getSolBalance, getBalance} from "./func.js";
import Target from "../model/targetModel.js";
import User from "../model/userModel.js";
let ws = null;
let wsThread = null;
const TOKEN = "7897293309:AAGtM0y5fwk-YuNlo1llgRN5LvHgW2DKpcs";
let tgID = "";
let mineWallet = "";
let tgUsername = "";
let myTargetWalletList = [];
const cieloUrl = "https://feed-api.cielo.finance/api/v1/tracked-wallets";
const headers = {
    accept: "application/json",
    "content-type": "application/json",
    "X-API-KEY": "22e3b1e2-df44-4cbf-8b36-207b80a68ac4",
};

function runWebSocket() {
    ws = new WebSocket("wss://feed-api.cielo.finance/api/v1/ws", {
        headers: {"X-API-KEY": "22e3b1e2-df44-4cbf-8b36-207b80a68ac4"},
    });

    ws.on("open", onOpen);
    ws.on("message", onMessage);
    ws.on("error", onError);
    ws.on("close", onClose);
}

async function addTrackedWallets(wallet, label) {
    try {
        const response = await fetch(cieloUrl, {
            method: "POST",
            headers,
            body: JSON.stringify({wallet, label}),
        });
        console.log(`${wallet} is added to track wallet list ${label}`);
    } catch (error) {
        console.error("An error occurred:", error);
    }
}

async function getTrackedWallets() {
    const response = await fetch(cieloUrl, {headers});
    return response.json();
}

async function sendMessageToTelegram(message) {
    const {
        token0_amount,
        token0_address,
        token0_symbol,
        token0_amount_usd,
        token1_amount,
        token1_address,
        token1_symbol,
        token1_amount_usd,
        tx_hash,
        wallet,
        timestamp,
    } = message;
    console.log("mineWallet", mineWallet, wallet);
    console.log("myWalletList", myTargetWalletList);

    if (myTargetWalletList.includes(wallet)) {
        if (mineWallet !== wallet) {
            const messageContent =
                `💼 \`${shortenString(wallet)}\`\n` +
                `⭐️ **From**: ${toSciNotationFixed(token0_amount)} #${token0_symbol} ➡️ **To**: ${toSciNotationFixed(
                    token1_amount
                )} #${token1_symbol} ($${token1_amount_usd.toFixed(3)})\n` +
                `🔗 [Tx Hash](https://solscan.io/tx/${tx_hash})  📅 **Date**: ${convertUtcToLocalTime(timestamp)}`;

            try {
                await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
                    chat_id: tgID,
                    text: messageContent,
                    parse_mode: "Markdown",
                    disable_web_page_preview: true,
                });
            } catch (error) {
                console.error("Error sending message to Telegram:", error);
            }
            const userData = await Target.findOne({target_wallet: wallet, username: tgUsername});
            if (!userData) return;

            const max_buy = parseFloat(userData.max_buy);
            const min_buy = parseFloat(userData.min_buy);
            const buy_percentage = parseFloat(userData.buy_percentage);
            const buy_slippage = parseFloat(userData.buy_slippage);
            const sell_slippage = parseFloat(userData.buy_slippage);

            if (token0_symbol === "SOL") {
                const solBal = await getSolBalance(mineWallet);
                const expBal = token0_amount * (buy_percentage / 100);

                if (expBal > max_buy) {
                    if (max_buy > solBal) {
                        sendAlert(solBal, expBal, token1_symbol);
                    } else {
                        console.log("swap", solBal, max_buy);
                        swapTokens(token0_address, token1_address, Math.max(min_buy, max_buy), buy_slippage);
                    }
                } else {
                    if (expBal > solBal) {
                        sendAlert(solBal, expBal, token1_symbol);
                    } else {
                        console.log("swap buy", expBal, solBal);
                        swapTokens(token0_address, token1_address, Math.max(min_buy, expBal), buy_slippage);
                    }
                }
            } else {
                const tokenBal = await getBalance(mineWallet);
                const expBal = token0_amount * (buy_percentage / 100);
                console.log("swap sell", tokenBal, expBal);
                swapTokens(token0_address, token1_address, Math.min(tokenBal, expBal), sell_slippage);
            }
        } else {
            const messageContent =
                `💼 My Wallet \`${shortenString(wallet)}\`\n` +
                `⭐️ **From**: ${toSciNotationFixed(token0_amount)} #${token0_symbol} ➡️ **To**: ${toSciNotationFixed(
                    token1_amount
                )} #${token1_symbol} ($${token1_amount_usd.toFixed(3)})\n` +
                `🔗 [Tx Hash](https://solscan.io/tx/${tx_hash})  📅 **Date**: ${convertUtcToLocalTime(timestamp)}`;

            try {
                await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
                    chat_id: tgID,
                    text: messageContent,
                    parse_mode: "Markdown",
                    disable_web_page_preview: true,
                });
            } catch (error) {
                console.error("Error sending message to Telegram:", error);
            }
        }
    }
}

async function sendAlert(currentBalance, requiredBalance, tokenName) {
    console.log("alert");

    const alertContent =
        `⚠️ **Insufficient SOL Balance Alert!**\n\n` +
        `Your current SOL balance is **${currentBalance} SOL**, which is not enough to cover **${requiredBalance} SOL** for **${tokenName}**.\n\n` +
        `**Action Required:** Ensure you have enough SOL in your wallet to proceed.`;

    await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
        chat_id: tgID,
        text: alertContent,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
    });
}

async function deleteTrackedWallets(id) {
    await fetch(cieloUrl, {
        method: "DELETE",
        headers,
        body: JSON.stringify({wallet_ids: id}),
    });
}

function onOpen() {
    console.log("Real-time tracking started..");
    const subscribeMessage = {
        type: "subscribe_feed",
        filter: {
            tx_types: ["swap"],
            chains: ["solana"],
        },
    };
    ws.send(JSON.stringify(subscribeMessage));
}

function onMessage(data) {
    const message = JSON.parse(data);
    if (message.type === "tx" && message.data.token0_address !== message.data.token1_address) {
        sendMessageToTelegram(message.data);
    }
}

function onError(error) {
    console.error("WebSocket error:", error);
    onOpen();
}

function onClose(code, msg) {
    console.log("WebSocket connection closed", code, msg);
}

async function startMonitor(username, userid) {
    console.log("Start monitor", username);
    tgID = userid;
    tgUsername = username;
    const currentWallet = await Target.find({username, added: true});
    const mineWalletData = await User.findOne({username});
    mineWallet = mineWalletData.public_key;
    swap_init(mineWalletData.private_key);
    const walletList = currentWallet.map((wallet) => wallet.target_wallet);
    walletList.push(mineWallet);
    myTargetWalletList = [];
    currentWallet.map((wallet) => {
        myTargetWalletList.push(wallet.target_wallet);
    });
    const trackedData = await getTrackedWallets();

    for (const traderWallet of walletList) {
        if (!trackedData.data.tracked_wallets.some((wallet) => wallet.wallet === traderWallet)) {
            try {
                await addTrackedWallets(traderWallet, traderWallet);
            } catch (error) {
                console.error("Error adding wallet:", traderWallet, error);
            }
        }
    }

    wsThread = new Promise((resolve) => {
        runWebSocket();
        resolve();
    });
}

async function stopMonitor(username) {
    console.log("Stop monitor", username);
    if (ws) {
        ws.close();
        ws = null;
    }
    if (wsThread) {
        await wsThread;
        wsThread = null;
    }
}

export default {startMonitor, stopMonitor};

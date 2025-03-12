import TelegramBot from "node-telegram-bot-api";
import * as solanaWeb3 from "@solana/web3.js";
import base58 from "bs58";
import {connectDB} from "./config/db.js";
import User from "./model/userModel.js";
import Target from "./model/targetModel.js";
import Monitor from "./utiles/monitor.js";
// Replace 'YOUR_TELEGRAM_BOT_TOKEN' with your actual bot token
const TOKEN = "7897293309:AAGtM0y5fwk-YuNlo1llgRN5LvHgW2DKpcs";
const bot = new TelegramBot(TOKEN, {polling: true});

connectDB();
// MongoDB connection
// State variable to track if the bot is expecting a private key
const expectingPrivateKey = {};

// State variable to track which field the user is editing
const editingField = {};

// Dictionary to store message IDs
const messageIds = {};

bot.onText(/\/start/, async (msg) => {
    console.log("userInfo", msg);

    const chatId = msg.chat.id;
    const username = msg.from.username || "Unknown";
    console.log(`User @${username} has started the bot.`);
    const userDb = await User.findOne({username});

    const keyboard = [
        [
            {text: "Copy Trade", callback_data: "trade"},
            {text: "Wallet Setting", callback_data: "setting"},
        ],
    ];
    const replyMarkup = JSON.stringify({inline_keyboard: keyboard});

    let message;
    if (!userDb) {
        message = `
*Welcome to copy trade bot \`${username}\`*

You didn't connect your wallet

To start copy trade, please connect your wallet`;
    } else {
        const solBalance = await getSolBalance(userDb.public_key);
        message = `
*Welcome to copy trade bot \`${username}\`*

*Your current wallet address:*
    \`${userDb.public_key}\`

*Your current balance:*
    \`${solBalance} SOL\``;
    }

    const sentMessage = await bot.sendMessage(chatId, message, {parse_mode: "MarkdownV2", reply_markup: replyMarkup});
    messageIds[username] = [sentMessage.message_id];
});

bot.onText(/\/stop/, async (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username || "Unknown";
    console.log(username);

    const userDb = await User.findOne({username});
    await Monitor.stopMonitor(username);
    let message;
    if (!userDb) {
        message = `
    *Welcome to copy trade bot \`${username}\`*

    You didn't connect your wallet

    To start copy trade, please connect your wallet`;
    } else {
        const solBalance = await getSolBalance(userDb.public_key);
        message = `
    *Welcome to copy trade bot \`${username}\`*

    *Your current wallet address:*
        \`${userDb.public_key}\`

    *Your current balance:*
        \`${solBalance} SOL\``;
    }

    const keyboard = [
        [{text: "Add new target wallet", callback_data: "add_new_target_wallet"}],
        [{text: "All target wallet list", callback_data: "target_wallet_list"}],
        [{text: "Start Trade", callback_data: "start_trade"}],
        // [{text: "Exclude tokens", callback_data: "exclude_tokens"}],
        [
            {text: "🔙 Back", callback_data: "back_to_main"},
            {text: "Refresh", callback_data: "refresh_second"},
        ],
    ];
    const replyMarkup = JSON.stringify({inline_keyboard: keyboard});
    const sentMessage = await bot.sendMessage(chatId, message, {parse_mode: "MarkdownV2", reply_markup: replyMarkup});
    if (messageIds[username]) {
        messageIds[username].push(sentMessage.message_id);
    } else {
        messageIds[username] = [sentMessage.message_id];
    }
});

bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const username = query.from.username || "Unknown";
    const userDb = await User.findOne({username});

    if (query.data === "trade") {
        if (!userDb) return;
        const keyboard = [
            [{text: "Add new target wallet", callback_data: "add_new_target_wallet"}],
            [{text: "All target wallet list", callback_data: "target_wallet_list"}],
            [{text: "Start Trade", callback_data: "start_trade"}],
            // [{text: "Exclude tokens", callback_data: "exclude_tokens"}],
            [
                {text: "🔙 Back", callback_data: "back_to_main"},
                {text: "Refresh", callback_data: "refresh_second"},
            ],
        ];
        const replyMarkup = JSON.stringify({inline_keyboard: keyboard});
        await bot.editMessageReplyMarkup(replyMarkup, {chat_id: chatId, message_id: query.message.message_id});
        if (messageIds[username]) {
            messageIds[username].push(query.message.message_id);
        } else {
            messageIds[username] = [query.message.message_id];
        }
    } else if (query.data === "setting") {
        if (!userDb) {
            const keyboard = [
                [
                    {text: "Connect wallet", callback_data: "connect"},
                    {text: "Back", callback_data: "back_to_main"},
                ],
            ];
            const replyMarkup = JSON.stringify({inline_keyboard: keyboard});
            await bot.editMessageReplyMarkup(replyMarkup, {chat_id: chatId, message_id: query.message.message_id});
        } else {
            const keyboard = [
                [
                    {text: "Change wallet", callback_data: "change"},
                    {text: "Back", callback_data: "back_to_main"},
                ],
            ];
            const replyMarkup = JSON.stringify({inline_keyboard: keyboard});
            await bot.editMessageReplyMarkup(replyMarkup, {chat_id: chatId, message_id: query.message.message_id});
        }
        if (messageIds[username]) {
            messageIds[username].push(query.message.message_id);
        } else {
            messageIds[username] = [query.message.message_id];
        }
    } else if (query.data === "connect") {
        expectingPrivateKey[username] = true;
        const keyboard = [[{text: "🔙 Back", callback_data: "back_to_main"}]];
        const replyMarkup = JSON.stringify({inline_keyboard: keyboard});
        await bot.editMessageReplyMarkup(replyMarkup, {chat_id: chatId, message_id: query.message.message_id});
        const sentMessage = await bot.sendMessage(
            chatId,
            "To connect your wallet, please input your wallet private key."
        );

        if (messageIds[username]) {
            messageIds[username].push(sentMessage.message_id);
        } else {
            messageIds[username] = [sentMessage.message_id];
        }
    } else if (query.data === "change") {
        expectingPrivateKey[username] = true;
        const keyboard = [[{text: "🔙 Back", callback_data: "back_to_main"}]];
        const replyMarkup = JSON.stringify({inline_keyboard: keyboard});
        await bot.editMessageReplyMarkup(replyMarkup, {chat_id: chatId, message_id: query.message.message_id});
        const sentMessage = await bot.sendMessage(
            chatId,
            "To change your wallet, please input your other wallet private key."
        );
        if (messageIds[username]) {
            messageIds[username].push(sentMessage.message_id);
        } else {
            messageIds[username] = [sentMessage.message_id];
        }
    } else if (query.data === "add_new_target_wallet") {
        let currentWallet = await Target.findOne({added: false, username});
        if (currentWallet == null) {
            await Target.insertOne({
                added: false,
                username,
                wallet_label: "-",
                target_wallet: "",
                buy_percentage: 100,
                max_buy: 0,
                min_buy: 0,
                total_invest_sol: 0,
                each_token_buy_times: 0,
                trader_tx_max_limit: 0,
                exclude_tokens: [],
                max_marketcap: 0,
                min_marketcap: 0,
                auto_retry_times: 1,
                buy_slippage: 50,
                sell_slippage: 50,
                tip: 50,
                buy_gas_fee: 0.005,
                sell_gas_fee: 0.005,
                created_at: new Date(),
            });
            currentWallet = await Target.findOne({username, added: false});
        }
        const keyboard = [
            [{text: `Wallet label: ${currentWallet.wallet_label || "-"}`, callback_data: "wallet_label"}],
            [
                {
                    text: `Target wallet: ${currentWallet.target_wallet.slice(
                        0,
                        5
                    )}...${currentWallet.target_wallet.slice(-5)}`,
                    callback_data: "target_wallet",
                },
            ],
            [{text: `Buy percentage: ${currentWallet.buy_percentage || 0}%`, callback_data: "buy_percentage"}],
            [
                {text: `Max Buy: ${currentWallet.max_buy || 0}`, callback_data: "max_buy"},
                {text: `Min Buy: ${currentWallet.min_buy || 0}`, callback_data: "min_buy"},
            ],
            [{text: `Total invest: ${currentWallet.total_invest_sol || 0} sol`, callback_data: "total_invest_sol"}],
            [
                {
                    text: `Each Token Buy times: ${currentWallet.each_token_buy_times || 0}`,
                    callback_data: "each_token_buy_times",
                },
            ],
            [
                {
                    text: `Trader's Tx max limit: ${currentWallet.trader_tx_max_limit || 0}`,
                    callback_data: "trader_tx_max_limit",
                },
            ],
            [{text: `Exclude tokens: ${currentWallet.exclude_tokens.length || 0}`, callback_data: "exclude_tokens"}],
            [
                {text: `Max MC: ${currentWallet.max_marketcap || 0}`, callback_data: "max_mc"},
                {text: `Min MC: ${currentWallet.min_marketcap || 0}`, callback_data: "min_mc"},
            ],
            [{text: `Auto Retry: ${currentWallet.auto_retry_times || 0}`, callback_data: "auto_retry"}],
            [
                {text: `Buy Slippage: ${currentWallet.buy_slippage || 0}%`, callback_data: "buy_slippage"},
                {text: `Sell Slippage: ${currentWallet.sell_slippage || 0}%`, callback_data: "sell_slippage"},
            ],
            [{text: `Jito Dynamic Tip: ${currentWallet.tip || 0}%`, callback_data: "tip"}],
            [
                {text: `Buy Gas Fee: ${currentWallet.buy_gas_fee || 0} sol`, callback_data: "buy_gas_fee"},
                {text: `Sell Gas Fee: ${currentWallet.sell_gas_fee || 0} sol`, callback_data: "sell_gas_fee"},
            ],
            [{text: "➕ Create", callback_data: "create"}],
            [
                {text: "🔙 Back", callback_data: "back_to_second"},
                {text: "Refresh", callback_data: "refresh"},
            ],
        ];
        const replyMarkup = JSON.stringify({inline_keyboard: keyboard});
        await bot.editMessageReplyMarkup(replyMarkup, {chat_id: chatId, message_id: query.message.message_id});
        if (messageIds[username]) {
            messageIds[username].push(query.message.message_id);
        } else {
            messageIds[username] = [query.message.message_id];
        }
    } else if (query.data.startsWith("edit_")) {
        const walletName = query.data.split("_")[1];
        const wallet = await Target.findOne({username, target_wallet: walletName, added: true});
        const totalPnl = 0;
        const totalRoi = 0;
        const traded = 0;

        const copyPnl = 0;
        const copyRoi = 0;
        const copyTraded = 0;
        const message = `
Target Wallet: 
<code>${walletName}</code>  
PNL:    ${totalPnl.toFixed(2)}
ROI:     ${totalRoi.toFixed(2)}
Traded: ${traded} 

Copy trade:
PNL:    ${copyPnl.toFixed(2)}
ROI:     ${copyRoi.toFixed(2)}
Traded: ${copyTraded}
`;

        const keyboard = [
            [{text: "Change setting", callback_data: `change_${walletName}`}],
            [
                {text: "OK", callback_data: "back_to_main"},
                {text: "Remove", callback_data: "Remove"},
            ],
        ];
        const replyMarkup = JSON.stringify({inline_keyboard: keyboard});
        const sentMessage = await bot.sendMessage(chatId, message, {parse_mode: "HTML", reply_markup: replyMarkup});
        if (messageIds[username]) {
            messageIds[username].push(sentMessage.message_id);
        } else {
            messageIds[username] = [sentMessage.message_id];
        }
    } else if (query.data.startsWith("change_")) {
        const targetWallet = query.data.split("_")[1];
        await Target.deleteOne({username, added: false});
        const currentWallet = await Target.findOne({username, target_wallet: targetWallet, added: true});
        currentWallet.added = false;
        await Target.updateOne({username, target_wallet: targetWallet, added: true}, {$set: currentWallet});
        const userDb = await User.findOne({username});
        const solBalance = await getSolBalance(userDb.public_key);
        const message = `
*Welcome to copy trade bot \`${username}\`*

*Your current wallet address:*
    \`${userDb.public_key}\`

*Your current balance:*
    \`${solBalance} SOL\``;

        const keyboard = [
            [{text: `Wallet label: ${currentWallet.wallet_label || "-"}`, callback_data: "wallet_label"}],
            [
                {
                    text: `Target wallet: ${currentWallet.target_wallet.slice(
                        0,
                        5
                    )}...${currentWallet.target_wallet.slice(-5)}`,
                    callback_data: "target_wallet",
                },
            ],
            [{text: `Buy percentage: ${currentWallet.buy_percentage || 0}%`, callback_data: "buy_percentage"}],
            [
                {text: `Max Buy: ${currentWallet.max_buy || 0}`, callback_data: "max_buy"},
                {text: `Min Buy: ${currentWallet.min_buy || 0}`, callback_data: "min_buy"},
            ],
            [{text: `Total invest: ${currentWallet.total_invest_sol || 0} sol`, callback_data: "total_invest_sol"}],
            [
                {
                    text: `Each Token Buy times: ${currentWallet.each_token_buy_times || 0}`,
                    callback_data: "each_token_buy_times",
                },
            ],
            [
                {
                    text: `Trader's Tx max limit: ${currentWallet.trader_tx_max_limit || 0}`,
                    callback_data: "trader_tx_max_limit",
                },
            ],
            [{text: `Exclude tokens: ${currentWallet.exclude_tokens.length || 0}`, callback_data: "exclude_tokens"}],
            [
                {text: `Max MC: ${currentWallet.max_marketcap || 0}`, callback_data: "max_mc"},
                {text: `Min MC: ${currentWallet.min_marketcap || 0}`, callback_data: "min_mc"},
            ],
            [{text: `Auto Retry: ${currentWallet.auto_retry_times || 0}`, callback_data: "auto_retry"}],
            [
                {text: `Buy Slippage: ${currentWallet.buy_slippage || 0}%`, callback_data: "buy_slippage"},
                {text: `Sell Slippage: ${currentWallet.sell_slippage || 0}%`, callback_data: "sell_slippage"},
            ],
            [{text: `Jito Dynamic Tip: ${currentWallet.tip || 0}%`, callback_data: "tip"}],
            [
                {text: `Buy Gas Fee: ${currentWallet.buy_gas_fee || 0} sol`, callback_data: "buy_gas_fee"},
                {text: `Sell Gas Fee: ${currentWallet.sell_gas_fee || 0} sol`, callback_data: "sell_gas_fee"},
            ],
            [{text: "✅ Ok", callback_data: "create"}],
            [
                {text: "Remove", callback_data: "target_wallet_list"},
                {text: "Refresh", callback_data: "refresh"},
            ],
        ];
        const replyMarkup = JSON.stringify({inline_keyboard: keyboard});
        await bot.editMessageText(message, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: "MarkdownV2",
            reply_markup: replyMarkup,
        });
    } else if (query.data === "target_wallet_list") {
        const targetWallets = await Target.find({username, added: true});
        const keyboard = [];
        let index = 1;
        for (const wallet of targetWallets) {
            keyboard.push([
                {text: `${index} : ${wallet.target_wallet}`, callback_data: `edit_${wallet.target_wallet}`},
            ]);
            index += 1;
        }
        keyboard.push([{text: "🔙 Back", callback_data: "back_to_second"}]);
        const replyMarkup = JSON.stringify({inline_keyboard: keyboard});
        await bot.editMessageReplyMarkup(replyMarkup, {chat_id: chatId, message_id: query.message.message_id});
        if (messageIds[username]) {
            messageIds[username].push(query.message.message_id);
        } else {
            messageIds[username] = [query.message.message_id];
        }
    } else if (
        [
            "wallet_label",
            "target_wallet",
            "buy_percentage",
            "max_buy",
            "min_buy",
            "total_invest_sol",
            "each_token_buy_times",
            "tip",
            "trader_tx_max_limit",
            "exclude_tokens",
            "max_marketcap",
            "min_marketcap",
            "auto_retry",
            "buy_slippage",
            "sell_slippage",
            "buy_gas_fee",
            "sell_gas_fee",
        ].includes(query.data)
    ) {
        editingField[username] = query.data;
        const sentMessage = await bot.sendMessage(
            chatId,
            `Please enter the new value for ${query.data
            .replace(/_/g, " ") // Replace underscores with spaces
            .split(" ") // Split into words
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize first letter
            .join(" ")}:` // Join words back into a string
        );
        if (messageIds[username]) {
            messageIds[username].push(sentMessage.message_id);
        } else {
            messageIds[username] = [sentMessage.message_id];
        }
    } else if (query.data === "create") {
        const currentWallet = await Target.findOne({added: false, username});
        if (currentWallet.target_wallet === "" || currentWallet.wallet_label === "-") {
            const sentMessage = await bot.sendMessage(
                chatId,
                "Please input required fields (target wallet & wallet label)"
            );
            if (messageIds[username]) {
                messageIds[username].push(sentMessage.message_id);
            } else {
                messageIds[username] = [sentMessage.message_id];
            }
            return;
        }
        currentWallet.added = true;
        await Target.updateOne({username, added: false}, {$set: currentWallet});
        const targetWallets = await Target.find({username, added: true});
        const keyboard = [];
        let index = 1;
        for (const wallet of targetWallets) {
            keyboard.push([
                {text: `${index} : ${wallet.target_wallet}`, callback_data: `edit_${wallet.target_wallet}`},
            ]);
            index += 1;
        }
        keyboard.push([{text: "🔙 Back", callback_data: "back_to_second"}]);
        const replyMarkup = JSON.stringify({inline_keyboard: keyboard});
        await bot.editMessageReplyMarkup(replyMarkup, {chat_id: chatId, message_id: query.message.message_id});
    } else if (query.data === "refresh_second") {
        const userDb = await User.findOne({username});
        const solBalance = await getSolBalance(userDb.public_key);

        const message = `
        *Welcome to copy trade bot \`${username}\`*

        *Your current wallet address:*
            \`${userDb.public_key}\`

        *Your current balance:*
            \`${solBalance} SOL\``;

        const keyboard = {
            inline_keyboard: [
                [{text: "Add new target wallet", callback_data: "add_new_target_wallet"}],
                [{text: "All target wallet list", callback_data: "target_wallet_list"}],
                [{text: "Start Trade", callback_data: "start_trade"}],
                // [{ text: "Exclude tokens", callback_data: "exclude_tokens" }],
                [
                    {text: "🔙 Back", callback_data: "back_to_main"},
                    {text: "Refresh", callback_data: "refresh_second"},
                ],
            ],
        };
        try {
            await bot.editMessageText(message, {
                chat_id: query.message.chat.id,
                message_id: query.message.message_id,
                reply_markup: keyboard,
                parse_mode: "MarkdownV2",
            });
        } catch (e) {
            console.log("haha");
        }

        if (messageIds[username]) {
            messageIds[username].push(query.message.message_id);
        } else {
            messageIds[username] = [query.message.message_id];
        }
    } else if (query.data === "refresh") {
        const editingFieldData = {
            added: false,
            username,
            wallet_label: "-",
            target_wallet: "",
            buy_percentage: 100,
            max_buy: 0,
            min_buy: 0,
            total_invest_sol: 0,
            each_token_buy_times: 0,
            trader_tx_max_limit: 0,
            exclude_tokens: [],
            max_marketcap: 0,
            min_marketcap: 0,
            auto_retry_times: 1,
            buy_slippage: 50,
            sell_slippage: 50,
            buy_gas_fee: 0.005,
            sell_gas_fee: 0.005,
            tip: 50,
            created_at: new Date(),
        };
        await Target.updateOne({username, added: false}, {$set: editingFieldData});
        const currentWallet = await Target.findOne({username, added: false});
        const keyboard = [
            [{text: `Wallet label: ${currentWallet.wallet_label || "-"}`, callback_data: "wallet_label"}],
            [
                {
                    text: `Target wallet: ${currentWallet.target_wallet.slice(
                        0,
                        5
                    )}...${currentWallet.target_wallet.slice(-5)}`,
                    callback_data: "target_wallet",
                },
            ],
            [{text: `Buy percentage: ${currentWallet.buy_percentage || 0}%`, callback_data: "buy_percentage"}],
            [
                {text: `Max Buy: ${currentWallet.max_buy || 0}`, callback_data: "max_buy"},
                {text: `Min Buy: ${currentWallet.min_buy || 0}`, callback_data: "min_buy"},
            ],
            [{text: `Total invest: ${currentWallet.total_invest_sol || 0} sol`, callback_data: "total_invest_sol"}],
            [
                {
                    text: `Each Token Buy times: ${currentWallet.each_token_buy_times || 0}`,
                    callback_data: "each_token_buy_times",
                },
            ],
            [
                {
                    text: `Trader's Tx max limit: ${currentWallet.trader_tx_max_limit || 0}`,
                    callback_data: "trader_tx_max_limit",
                },
            ],
            [{text: `Exclude tokens: ${currentWallet.exclude_tokens.length || 0}`, callback_data: "exclude_tokens"}],
            [
                {text: `Max MC: ${currentWallet.max_marketcap || 0}`, callback_data: "max_mc"},
                {text: `Min MC: ${currentWallet.min_marketcap || 0}`, callback_data: "min_mc"},
            ],
            [{text: `Auto Retry: ${currentWallet.auto_retry_times || 0}`, callback_data: "auto_retry"}],
            [
                {text: `Buy Slippage: ${currentWallet.buy_slippage || 0}%`, callback_data: "buy_slippage"},
                {text: `Sell Slippage: ${currentWallet.sell_slippage || 0}%`, callback_data: "sell_slippage"},
            ],
            [{text: `Jito Dynamic Tip: ${currentWallet.tip || 0}%`, callback_data: "tip"}],
            [
                {text: `Buy Gas Fee: ${currentWallet.buy_gas_fee || 0} sol`, callback_data: "buy_gas_fee"},
                {text: `Sell Gas Fee: ${currentWallet.sell_gas_fee || 0} sol`, callback_data: "sell_gas_fee"},
            ],
            [{text: "➕ Create", callback_data: "create"}],
            [
                {text: "🔙 Back", callback_data: "back_to_second"},
                {text: "Refresh", callback_data: "refresh"},
            ],
        ];
        const replyMarkup = JSON.stringify({inline_keyboard: keyboard});
        try {
            await bot.editMessageReplyMarkup(replyMarkup, {chat_id: chatId, message_id: query.message.message_id});
        } catch (e) {
            console.log("haha");
        }
    } else if (query.data === "back_to_second") {
        const keyboard = [
            [{text: "Add new target wallet", callback_data: "add_new_target_wallet"}],
            [{text: "All target wallet list", callback_data: "target_wallet_list"}],
            [{text: "Start Trade", callback_data: "start_trade"}],
            // [{text: "Exclude tokens", callback_data: "exclude_tokens"}],
            [
                {text: "🔙 Back", callback_data: "back_to_main"},
                {text: "Refresh", callback_data: "refresh_second"},
            ],
        ];
        const replyMarkup = JSON.stringify({inline_keyboard: keyboard});
        await bot.editMessageReplyMarkup(replyMarkup, {chat_id: chatId, message_id: query.message.message_id});
        if (messageIds[username]) {
            messageIds[username].push(query.message.message_id);
        } else {
            messageIds[username] = [query.message.message_id];
        }
    } else if (query.data === "back_to_main") {
        const keyboard = [
            [
                {text: "Copy Trade", callback_data: "trade"},
                {text: "Wallet Setting", callback_data: "setting"},
            ],
        ];
        const replyMarkup = JSON.stringify({inline_keyboard: keyboard});
        await bot.editMessageReplyMarkup(replyMarkup, {chat_id: chatId, message_id: query.message.message_id});
    } else if (query.data === "start_trade") {
        const username = query.from.username || "Unknown";
        const userid = query.from.id || "Unknown";
        console.log("start trade", username, userid);
        await bot.sendMessage(chatId, "Copy trading bot running...");
        await Monitor.startMonitor(username, userid);
    }

    await bot.answerCallbackQuery(query.id);
});

async function backTrade(msg, username) {
    const chatId = msg.chat.id;
    const userDb = await User.findOne({username});
    if (userDb == null) return;
    const solBalance = await getSolBalance(userDb.public_key);
    const message = `
*Welcome to copy trade bot \`${username}\`*

*Your current wallet address:*
    \`${userDb.public_key}\`

*Your current balance:*
    \`${solBalance} SOL\``;

    const currentWallet = await Target.findOne({username, added: false});
    if (currentWallet != null) {
        const keyboard = [
            [{text: `Wallet label: ${currentWallet.wallet_label || "-"}`, callback_data: "wallet_label"}],
            [
                {
                    text: `Target wallet: ${currentWallet.target_wallet.slice(
                        0,
                        5
                    )}...${currentWallet.target_wallet.slice(-5)}`,
                    callback_data: "target_wallet",
                },
            ],
            [{text: `Buy percentage: ${currentWallet.buy_percentage || 0}%`, callback_data: "buy_percentage"}],
            [
                {text: `Max Buy: ${currentWallet.max_buy || 0}`, callback_data: "max_buy"},
                {text: `Min Buy: ${currentWallet.min_buy || 0}`, callback_data: "min_buy"},
            ],
            [{text: `Total invest: ${currentWallet.total_invest_sol || 0} sol`, callback_data: "total_invest_sol"}],
            [
                {
                    text: `Each Token Buy times: ${currentWallet.each_token_buy_times || 0}`,
                    callback_data: "each_token_buy_times",
                },
            ],
            [
                {
                    text: `Trader's Tx max limit: ${currentWallet.trader_tx_max_limit || 0}`,
                    callback_data: "trader_tx_max_limit",
                },
            ],
            [{text: `Exclude tokens: ${currentWallet.exclude_tokens.length || 0}`, callback_data: "exclude_tokens"}],
            [
                {text: `Max MC: ${currentWallet.max_marketcap || 0}`, callback_data: "max_mc"},
                {text: `Min MC: ${currentWallet.min_marketcap || 0}`, callback_data: "min_mc"},
            ],
            [{text: `Auto Retry: ${currentWallet.auto_retry_times || 0}`, callback_data: "auto_retry"}],
            [
                {text: `Buy Slippage: ${currentWallet.buy_slippage || 0}%`, callback_data: "buy_slippage"},
                {text: `Sell Slippage: ${currentWallet.sell_slippage || 0}%`, callback_data: "sell_slippage"},
            ],
            [{text: `Jito Dynamic Tip: ${currentWallet.tip || 0}%`, callback_data: "tip"}],
            [
                {text: `Buy Gas Fee: ${currentWallet.buy_gas_fee || 0} sol`, callback_data: "buy_gas_fee"},
                {text: `Sell Gas Fee: ${currentWallet.sell_gas_fee || 0} sol`, callback_data: "sell_gas_fee"},
            ],
            [{text: "➕ Create", callback_data: "create"}],
            [
                {text: "🔙 Back", callback_data: "back_to_second"},
                {text: "Refresh", callback_data: "refresh"},
            ],
        ];
        const replyMarkup = JSON.stringify({inline_keyboard: keyboard});
        const sentMessage = await bot.sendMessage(chatId, message, {
            parse_mode: "MarkdownV2",
            reply_markup: replyMarkup,
        });
        await deletePreviousMessages(chatId, username);
        if (messageIds[username]) {
            messageIds[username].push(sentMessage.message_id);
        } else {
            messageIds[username] = [sentMessage.message_id];
        }
    }
}

async function handlePrivateKey(msg, username) {
    const chatId = msg.chat.id;
    const privateKey = msg.text;
    console.log(`Received private key for user @${username}: ${privateKey}`);
    await bot.deleteMessage(chatId, msg.message_id);
    let sol_public_key_str = "";
    try {
        sol_public_key_str = await derive_public_key(privateKey);
        await User.findOne({username});
        await User.updateOne(
            {username: username},
            {
                $set: {public_key: sol_public_key_str, private_key: privateKey},
            },
            {upsert: true}
        );
        const solBalance = await getSolBalance(sol_public_key_str);
        await deletePreviousMessages(chatId, username);
        const keyboard = [
            [
                {text: "Copy Trade", callback_data: "trade"},
                {text: "Wallet Setting", callback_data: "setting"},
            ],
        ];
        const replyMarkup = JSON.stringify({inline_keyboard: keyboard});
        const message = `   
*Wallet updated successfully \`${username}\`*

*Your current wallet address:*
    \`${sol_public_key_str}\`

*Your current balance:*
    \`${solBalance} SOL\``;
        const sentMessage = await bot.sendMessage(chatId, message, {
            parse_mode: "MarkdownV2",
            reply_markup: replyMarkup,
        });
        if (messageIds[username]) {
            messageIds[username].push(sentMessage.message_id);
        } else {
            messageIds[username] = [sentMessage.message_id];
        }
    } catch (e) {
        console.error("Error fetching SOL balance:", e);
        const sentMessage = await bot.sendMessage(chatId, "Error fetching SOL balance. Please try again.");
        if (messageIds[username]) {
            messageIds[username].push(sentMessage.message_id);
        } else {
            messageIds[username] = [sentMessage.message_id];
        }
    }

    expectingPrivateKey[username] = false;
}

async function handleInput(msg, username) {
    const chatId = msg.chat.id;
    const field = editingField[username];
    const value = msg.text;

    if (
        field === "buy_percentage" ||
        field === "max_buy" ||
        field === "min_buy" ||
        field === "total_invest_sol" ||
        field === "each_token_buy_times" ||
        field === "trader_tx_max_limit" ||
        field === "max_marketcap" ||
        field === "min_marketcap" ||
        field === "buy_slippage" ||
        field === "auto_retry_times" ||
        field === "buy_slippage" ||
        field === "sell_slippage" ||
        field === "tip" ||
        field === "buy_gas_fee" ||
        field === "sell_gas_fee"
    ) {
        // if (!/^\d+$/.test(value) || parseFloat(value) < 0) {
        //     const sentMessage = await bot.sendMessage(chatId, "Please enter a valid number.");
        //     if (messageIds[username]) {
        //         messageIds[username].push(sentMessage.message_id);
        //     } else {
        //         messageIds[username] = [sentMessage.message_id];
        //     }
        //     return;
        // }
        if (!/^\d+(\.\d+)?$/.test(value) || parseFloat(value) < 0) {
            const sentMessage = await bot.sendMessage(chatId, "Please enter a valid number.");
            if (messageIds[username]) {
                messageIds[username].push(sentMessage.message_id);
            } else {
                messageIds[username] = [sentMessage.message_id];
            }
            return;
        }
    }

    if (field === "wallet_label") {
        const existWalletWallet = await Target.findOne({username, wallet_label: value});
        if (existWalletWallet) {
            const sentMessage = await bot.sendMessage(chatId, "This wallet label already exists.");
            if (messageIds[username]) {
                messageIds[username].push(sentMessage.message_id);
            } else {
                messageIds[username] = [sentMessage.message_id];
            }
            return;
        }
    }

    if (field === "target_wallet" || field === "exclude_tokens") {
        if (field === "target_wallet") {
            const existWallet = await Target.findOne({username, added: true, target_wallet: value});
            if (existWallet) {
                const sentMessage = await bot.sendMessage(
                    chatId,
                    "This wallet address already exists in target wallet list."
                );
                if (messageIds[username]) {
                    messageIds[username].push(sentMessage.message_id);
                } else {
                    messageIds[username] = [sentMessage.message_id];
                }
                return;
            }
        }
        if (value.length !== 43 && value.length !== 44) {
            const sentMessage = await bot.sendMessage(chatId, "Please enter valid target wallet address.");
            if (messageIds[username]) {
                messageIds[username].push(sentMessage.message_id);
            } else {
                messageIds[username] = [sentMessage.message_id];
            }
            return;
        }
        const base58Pattern = /^[A-HJ-NP-Za-km-z1-9]+$/;
        if (!base58Pattern.test(value)) {
            const sentMessage = await bot.sendMessage(chatId, "Please enter valid target wallet address.");
            if (messageIds[username]) {
                messageIds[username].push(sentMessage.message_id);
            } else {
                messageIds[username] = [sentMessage.message_id];
            }
            return;
        }
    }
    await bot.deleteMessage(chatId, msg.message_id);
    await Target.updateOne({username, added: false}, {$set: {[field]: value}});
    editingField[username] = [];
    await deletePreviousMessages(chatId, username);
    await backTrade(msg, username);
}

async function derive_public_key(privateKey) {
    const privateKeyBytes = base58.decode(privateKey);
    if (privateKeyBytes.length !== 64) {
        throw new Error("Invalid private key length for Solana.");
    }
    const solKeypair = solanaWeb3.Keypair.fromSecretKey(privateKeyBytes);
    const solPublicKey = solKeypair.publicKey.toBase58();
    // console.log(`Derived Solana public key: ${solPublicKey}`);
    return solPublicKey;
}

async function getSolBalance(publicKey) {
    const solClient = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl("mainnet-beta"));
    const solBalance = await solClient.getBalance(new solanaWeb3.PublicKey(publicKey));
    const balanceInSol = solBalance / solanaWeb3.LAMPORTS_PER_SOL;
    // console.log(`SOL balance for ${publicKey}: ${balanceInSol} SOL`);
    return balanceInSol;
}

bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username || "Unknown";

    if (expectingPrivateKey[username]) {
        await handlePrivateKey(msg, username);
    } else {
        await handleInput(msg, username);
    }
});

async function deletePreviousMessages(chatId, username) {
    console.log("msgIDs", messageIds);
    if (messageIds[username]) {
        for (const messageId of messageIds[username]) {
            try {
                await bot.deleteMessage(chatId, messageId);
            } catch (e) {
                console.error("Failed to delete message");
            }
        }
        messageIds[username] = [];
    }
    console.log("aftermsgIDs", messageIds);
}

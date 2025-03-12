import mongoose from "mongoose";
const Schema = mongoose.Schema;

// Define the User Schema
const TargetSchema = new Schema(
  {
    username: { type: String, required: true },
    added:{type:Boolean, default:false},
    wallet_label: { type: String, default: '' },
    target_wallet: { type: String, default: '' },
    buy_percentage: { type: Number, default: 50 },
    max_buy: { type: Number, default: 1 },
    min_buy: { type: Number, default: 0.001 },
    total_invest_sol: { type: Number, default: 0 },
    each_token_buy_times: { type: Number, default: 0 },
    trader_tx_max_limit: { type: Number, default: 0 },
    exclude_tokens: { type: [String], default: [] },
    max_marketcap: { type: Number, default: 0 },
    min_marketcap: { type: Number, default: 0 },
    auto_retry_times: { type: Number, default: 1 },
    buy_slippage: { type: Number, default: 50 },
    sell_slippage: { type: Number, default: 50 },
    tip: { type: Number, default: 50 },
    buy_gas_fee: { type: Number, default: 0.005 },
    sell_gas_fee: { type: Number, default: 0.005 },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: true } // Optional: Adds createdAt and updatedAt timestamps
);

// Register the Trend model
const Target = mongoose.model("Target", TargetSchema, "Target");

// Export the Trend model instead of the schema
export default Target;

import mongoose from "mongoose";
const Schema = mongoose.Schema;

// Define the User Schema
const UserSchema = new Schema(
{
    username: { type: String, required: true, unique: true },
    private_key: { type: String, required: true },
    public_key: { type: String, required: true }
}, {
    timestamps: true // Automatically manage createdAt and updatedAt fields
}
);

// Register the Trend model
const User = mongoose.model("User", UserSchema, "Userinfo");

// Export the Trend model instead of the schema
export default User;

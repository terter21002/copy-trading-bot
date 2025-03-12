import dotenv from 'dotenv';
import mongoose from 'mongoose';
dotenv.config();
import Target from '../model/targetModel.js';


export const connectDB = async () => {
    const mongoURI = process.env.mongoURI;

    if (!mongoURI) {
        throw new Error('MongoDB URI is not defined in .env file');
    }

    try {
        await mongoose.connect(mongoURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            dbName:'CopyTrading'
        });
        console.log('MongoDB Connected...');
    } catch (err) {
        console.error(err.message);
        process.exit(1); // Exit process with failure
    }
    // await TestDB();
};
async function TestDB() {
    try {
        const existingTrend = await Target.findOne({});
        if (!existingTrend) {
            console.log("Default Trend Document Not Found.");
        } else {
            console.log('Default Trend Document Already Exists');
        }
    } catch (error) {
        console.error('Error ensuring default Trend:');
    }
}
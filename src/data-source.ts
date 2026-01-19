import { User } from "./entity/User"
import { DataSource } from "typeorm";
import { emploe } from "./entity/users";
import dotenv from 'dotenv';
dotenv.config();

export const AppDataSource = new DataSource({
    type: "mongodb",
    url: process.env.MONGO_URI || '',
    synchronize: true,
    logging: true,
    entities: [User, emploe], // Explicit imports
    // useUnifiedTopology: true,
});
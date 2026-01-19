import { DataSource } from "typeorm";
import { Admin } from "./entity/Admin";
import dotenv from 'dotenv';
dotenv.config();

export const AppDataSource = new DataSource({
    type: "mongodb",
    url: process.env.MONGO_URI || '',
    synchronize: true,
    logging: true,
    entities: [Admin],
    // useUnifiedTopology: true,
});
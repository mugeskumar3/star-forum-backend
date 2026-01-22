import { DataSource } from "typeorm";
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export const AppDataSource = new DataSource({
    type: "mongodb",
    url: process.env.MONGO_URI || '',
    synchronize: true,
    logging: true,
 entities: ["src/entity/**/*.ts","dist/entity/**/*.js"],
 // useUnifiedTopology: true,
});
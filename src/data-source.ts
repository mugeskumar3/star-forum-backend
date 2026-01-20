import { DataSource } from "typeorm";
import { Admin } from "./entity/Admin";
import dotenv from 'dotenv';
import { AdminUser } from "./entity/AdminUser";
dotenv.config();

export const AppDataSource = new DataSource({
    type: "mongodb",
    url: process.env.MONGO_URI || '',
    synchronize: true,
    logging: true,
    entities: [Admin, AdminUser],
    // useUnifiedTopology: true,
});
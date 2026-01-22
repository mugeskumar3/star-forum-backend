import { DataSource } from "typeorm";
import { Admin } from "./entity/Admin";
import dotenv from 'dotenv';
import { AdminUser } from "./entity/AdminUser";
import { Award } from "./entity/Award";
import { BusinessCategory } from "./entity/BusinessCategory";
import { Badge } from "./entity/Badge";
import { Region } from "./entity/Region";
import { Zone } from "./entity/Zone";
dotenv.config({ quiet: true });

export const AppDataSource = new DataSource({
    type: "mongodb",
    url: process.env.MONGO_URI || '',
    synchronize: true,
    logging: true,
    entities: [Admin, AdminUser,Award,BusinessCategory,Badge,Region,Zone],
    // useUnifiedTopology: true,
});
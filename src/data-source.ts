import { DataSource } from "typeorm";
import dotenv from "dotenv";
import dns from 'dns';

dotenv.config({ quiet: true });

const isProd = process.env.NODE_ENV === "prod";

// Set DNS servers for Node.js
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
dns.setDefaultResultOrder('ipv4first');

// Function to convert mongodb+srv:// to mongodb://
async function getMongoUrl(): Promise<string> {
    const mongoUri = process.env.MONGO_URI || "";

    if (!mongoUri.startsWith('mongodb+srv://')) {
        return mongoUri; // Already standard format
    }

    console.log('Converting SRV connection string to standard format...');

    try {
        // Extract parts from the SRV URL
        const url = new URL(mongoUri);
        const username = url.username;
        const password = url.password;
        const hostname = url.hostname;
        const database = url.pathname.slice(1).split('?')[0] || '';
        const searchParams = url.searchParams.toString();

        // Manually resolve SRV
        const dnsPromises = dns.promises;
        const srvRecords = await dnsPromises.resolveSrv(`_mongodb._tcp.${hostname}`);
        console.log('SRV Records resolved:', srvRecords.length, 'hosts');

        // Build hosts from SRV records
        const hosts = srvRecords.map(record => `${record.name}:${record.port}`).join(',');

        // Build standard connection string
        let connectionString = `mongodb://${username}:${encodeURIComponent(password)}@${hosts}`;

        if (database) {
            connectionString += `/${database}`;
        }

        // Add query parameters
        const params = searchParams ? `&${searchParams}` : '';
        connectionString += `?ssl=true&authSource=admin&retryWrites=true&w=majority${params}`;

        console.log('✅ Using standard MongoDB connection');
        return connectionString;

    } catch (error) {
        console.error('❌ SRV resolution failed:', error);

        // Fallback: guess the server names based on Atlas naming
        const url = new URL(mongoUri);
        const username = url.username;
        const password = url.password;
        const hostname = url.hostname;
        const database = url.pathname.slice(1).split('?')[0] || '';
        const clusterName = hostname.split('.')[0];
        const domainPart = hostname.split('.').slice(1).join('.');

        const hosts = [
            `${clusterName}-shard-00-00.${domainPart}:27017`,
            `${clusterName}-shard-00-01.${domainPart}:27017`,
            `${clusterName}-shard-00-02.${domainPart}:27017`
        ].join(',');

        let connectionString = `mongodb://${username}:${encodeURIComponent(password)}@${hosts}`;

        if (database) {
            connectionString += `/${database}`;
        }

        connectionString += `?ssl=true&authSource=admin&retryWrites=true&w=majority&replicaSet=atlas-${clusterName}-shard-0`;

        console.log('⚠️ Using fallback connection string');
        return connectionString;
    }
}

// Initialize DataSource asynchronously
export let AppDataSource: DataSource;

export async function initializeDataSource(): Promise<DataSource> {
    const mongoUrl = await getMongoUrl();

    AppDataSource = new DataSource({
        type: "mongodb",
        url: mongoUrl,
        synchronize: false,
        logging: !isProd,
        // useUnifiedTopology: true,
        entities: [
            isProd
                ? __dirname + "/entity/**/*.js"
                : "src/entity/**/*.ts"
        ],
    });

    await AppDataSource.initialize();
    console.log("✅ TypeORM DataSource initialized");
    return AppDataSource;
}
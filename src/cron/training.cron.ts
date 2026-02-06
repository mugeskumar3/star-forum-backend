import cron from "node-cron";
import { AppDataSource } from "../data-source";
import { Training } from "../entity/Training";
import { TrainingStatus } from "../enum/TrainingStatus";
const trainingRepo = AppDataSource.getMongoRepository(Training);

cron.schedule("*/5 * * * *", async () => {
    try {

        const now = new Date();
        const upcomingResult = await trainingRepo.updateMany(
            {
                isActive: 1,
                isDelete: 0,
                status: { $ne: TrainingStatus.CANCELLED },
                trainingDateTime: { $gt: now } as any
            },
            {
                $set: {
                    status: TrainingStatus.UPCOMING,
                    updatedAt: new Date()
                }
            }
        );

        const completedResult = await trainingRepo.updateMany(
            {
                isActive: 1,
                isDelete: 0,
                status: { $ne: TrainingStatus.CANCELLED },
                trainingDateTime: { $lte: now } as any
            },
            {
                $set: {
                    status: TrainingStatus.COMPLETED,
                    updatedAt: new Date()
                }
            }
        );

        console.log(
            `[TRAINING-CRON] Upcoming Updated: ${upcomingResult.modifiedCount} | Completed Updated: ${completedResult.modifiedCount}`
        );

    } catch (err) {
        console.error("[TRAINING-CRON] Error:", err);
    }
});

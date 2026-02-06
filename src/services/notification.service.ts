import { ObjectId } from "mongodb";
import { AppDataSource } from "../data-source";
import { Notifications } from "../entity/Notification";
import { sendPushNotification } from "./pushNotification.Service";
import { Member } from "../entity/Member";

export class NotificationService {
    private notificationRepo = AppDataSource.getMongoRepository(Notifications);
    private memRepo = AppDataSource.getMongoRepository(Member);
    /**
     * Create Notification
     */
    async createNotification({
        moduleName,
        moduleId,
        createdBy,
        subject,
        content,
        model,
        memberId
    }: {
        moduleName: string;
        moduleId: ObjectId | string;
        createdBy: ObjectId | string;
        members?: (ObjectId | string)[];
        subject?: string;
        content?: string;
        model?: string;
        memberId?: ObjectId | string;
    }) {
        const payload: any = {
            moduleName,
            moduleId: new ObjectId(moduleId),
            createdBy: new ObjectId(createdBy),
            updatedBy: new ObjectId(createdBy),
            isActive: 1,
            isRead: false,
            isDelete: 0,
            subject: subject ?? '',
            content: content ?? '',

        };

        const result = await this.notificationRepo.save(payload);

        if (result) {

            const token = model === 'Member' ? this.memRepo.findOne({ where: { _id: new ObjectId(memberId) } }) : null;
            await sendPushNotification(
                (await token).deviceToken, // You should replace this with the actual token of the user/device you want to send the notification to
                subject ?? 'New Notification',
                payload
            );
        }
        return result;
    }
    async createNotificationCommunity({
        moduleName,
        moduleId,
        createdBy,
        subject,
        content,
        categoryId
    }: {
        moduleName: string;
        moduleId: ObjectId | string;
        createdBy: ObjectId | string;
        subject?: string;
        content?: string;
        categoryId: ObjectId[];  // IMPORTANT for community
    }) {

        // 1. Fetch all members of this community category
        const members = await this.memRepo.find({
            where: {
                businessCategory: { $in: categoryId },
                isActive: 1,
                isDelete: 0
            }
        });

        const validMembers = members.filter(m => m.deviceToken);

        // 2. Bulk insert notifications
        const notificationPayloads = validMembers.map(member => ({
            moduleName,
            moduleId: new ObjectId(moduleId),
            createdBy: new ObjectId(createdBy),
            updatedBy: new ObjectId(createdBy),
            isActive: 1,
            isRead: false,
            isDelete: 0,
            subject: subject ?? "",
            content: content ?? "",
        }));

        await this.notificationRepo.insertMany(notificationPayloads);

        // 3. Send push notifications to all members (parallel)
        await Promise.all(
            validMembers.map(member =>
                sendPushNotification(
                    member.deviceToken,
                    subject ?? "New Notification",
                    {
                        moduleName,
                        moduleId,
                        content,
                    }
                )
            )
        );

        return { success: true, count: validMembers.length };
    }

}

import {
    Entity,
    ObjectIdColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn
} from "typeorm";
import { ObjectId } from "mongodb";

@Entity("notifications")
export class Notifications {
    @ObjectIdColumn()
    _id: ObjectId;

    @Column()
    moduleName: string;

    @Column()
    content: string;

    @Column()
    subject: string;

    @Column()
    moduleId: ObjectId;

    // 🔹 Audit
    @Column()
    createdBy: ObjectId;

    @Column()
    updatedBy: ObjectId;

    @Column({ default: 1 })
    isActive: number;

    @Column({ default: false })
    isRead: boolean;

    @Column({ default: 0 })
    isDelete: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}

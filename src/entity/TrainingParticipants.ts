import {
    Entity,
    ObjectIdColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn
} from "typeorm";
import { ObjectId } from "mongodb";

@Entity("training_participants")
export class TrainingParticipants {
    @ObjectIdColumn()
    _id: ObjectId;

    // 🔹 Thank to (Receiver name)
    @Column()
    memberId: ObjectId;

    @Column()
    trainingId: ObjectId;

    @Column()
    status: string;

    // 🔹 Amount
    @Column()
    paymentStatus: string;
    // 🔹 Audit
    @Column()
    createdBy: ObjectId;

    @Column()
    updatedBy: ObjectId;

    @Column({ default: 1 })
    isActive: number;

    @Column({ default: 0 })
    isDelete: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}

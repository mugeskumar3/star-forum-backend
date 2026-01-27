import {
    Entity,
    ObjectIdColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn
} from "typeorm";
import { ObjectId } from "mongodb";

@Entity("visitors")
export class Visitor {
    @ObjectIdColumn()
    _id: ObjectId;

    // 🔹 Visitor details
    @Column()
    visitorName: string;

    @Column()
    contactNumber: string;

    // 🔹 Business category (lookup)
    @Column()
    businessCategory: string;

    // 🔹 Source of event
    @Column()
    sourceOfEvent: string;

    // 🔹 Status
    @Column({ default: "MAY_BE" })
    status: "YES" | "MAY_BE" | "NO";

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

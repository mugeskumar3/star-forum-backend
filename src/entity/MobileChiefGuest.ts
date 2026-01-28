import {
    Entity,
    ObjectIdColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn
} from "typeorm";
import { ObjectId } from "mongodb";

@Entity("mobile_chief_guest")
export class MobileChiefGuest {
    @ObjectIdColumn()
    _id: ObjectId;

    // 🔹 Visitor details
    @Column()
    chiefGuestName: string;

    @Column()
    contactNumber: string;

    // 🔹 Business category (lookup)
    @Column()
    businessCategory: string;
    // 🔹 Visitor details
    @Column()
    businessName: string;
    // 🔹 Source of event
    @Column()
    email: string;

    @Column()
    location: string;

    @Column()
    address: string;
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

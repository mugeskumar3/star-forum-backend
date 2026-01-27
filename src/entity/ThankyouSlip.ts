import {
    Entity,
    ObjectIdColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn
} from "typeorm";
import { ObjectId } from "mongodb";

@Entity("thank_you_slips")
export class ThankYouSlip {
    @ObjectIdColumn()
    _id: ObjectId;

    // 🔹 Thank to (Receiver name)
    @Column()
    thankTo: ObjectId;

    // 🔹 Type: Inside / Outside
    @Column({ default: "New" })
    businedsType: "New" | "Repeat";

    @Column({ default: "Inside" })
    referralType: "Tier3+" | "Outside" | "Inside";

    // 🔹 Amount
    @Column()
    amount: number;

    // 🔹 Comments
    @Column({ nullable: true })
    comments?: string;

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

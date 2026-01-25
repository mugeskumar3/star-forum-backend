import {
    Entity,
    ObjectIdColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from "typeorm";
import { ObjectId } from "mongodb";
@Entity()
export class Member {

    @ObjectIdColumn()
    id: ObjectId;

    @Column("simple-json", { nullable: true })
    profileImage?: {
        fileName?: string;
        Path?: string;
        originalName?: string;
    };


    @Column()
    fullName: string;

    @Column()
    mobileNumber: string;

    @Column()
    email: string;

    @Column()
    companyName: string;

    @Column()
    membershipId: string;

    @Column()
    region: ObjectId;

    @Column()
    chapter: ObjectId;

    @Column()
    position: string;

    @Column()
    businessCategory: ObjectId;

    @Column()
    referredBy: ObjectId;

    @Column()
    dateOfBirth: Date;

    @Column()
    anniversary: Date;

    // OFFICE ADDRESS (Embedded Object)
    @Column()
    officeAddress: {
        doorNo: string;
        oldNo: string;
        street: string;
        area: string;
        city: string;
        state: string;
        pincode: string;
    };

    @Column({ default: false })
    isWantSmsEmailUpdates: boolean;

    // SUBSCRIPTION DETAILS
    @Column()
    annualFee: number;

    @Column()
    paymentMode: string;

    @Column()
    transactionId: string;

    @Column()
    paymentDate: Date;

    @Column()
    joiningDate: Date;

    @Column()
    renewalDate: Date;

    @Column()
    gstNumber: string;

    @Column({ default: false })
    sendWelcomeSms: boolean;

    // TRAINING REPORT
    @Column()
    trainingYear: string;

    @Column()
    trainingTypes: string[];

    @Column("simple-json", { nullable: true })
    trainings: {
        year: string;
        type: string;
    }[];

    @Column("simple-json", { nullable: true })
    awards: {
        tenure: string;
        award: ObjectId;
    }[];

    // CNI CLUB MEMBER
    @Column()
    clubMemberType: string;

    // SYSTEM FIELDS
    @Column({ default: 1 })
    isActive: number;

    @Column({ default: 0 })
    isDelete: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @Column()
    createdBy: ObjectId;

    @Column()
    updatedBy: ObjectId;

    @Column()
    badge: {
        name: string;
    }[];
}

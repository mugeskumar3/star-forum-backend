import { ObjectId } from "mongodb";
import {
    Entity,
    Column,
    ObjectIdColumn,
    CreateDateColumn,
    UpdateDateColumn
} from "typeorm";

@Entity("meetings")
export class Meeting {

    @ObjectIdColumn()
    _id: ObjectId;

    // --------------------
    // BASIC INFO
    // --------------------
    @Column()
    meetingTopic: string;

    @Column("double")
    meetingFee: number;

    @Column("double")
    visitorFee: number;

    @Column()
    hotelName: string;

    // --------------------
    // CHAPTERS (MULTI)
    // --------------------
    @Column()
    chapters: ObjectId[];   // multi-select chapters

    // --------------------
    // DATE & TIME
    // --------------------
    @Column()
    startDateTime: Date;

    @Column()
    endDateTime: Date;

    @Column()
    latePunchTime: Date;

    // --------------------
    // LOCATION (MAP)
    // --------------------
    @Column()
    location: {
        name: string;
        latitude: number;
        longitude: number;
    };

    // --------------------
    // SYSTEM FIELDS
    // --------------------
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

    @Column({ nullable: true })
    updatedBy?: ObjectId;
}

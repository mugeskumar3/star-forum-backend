import {
    Entity,
    ObjectIdColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn
} from "typeorm";
import { MeetingType, Weekday } from "../enum/chapter";
import { ObjectId } from "mongodb";

@Entity("chapters")
export class Chapter {
    @ObjectIdColumn()
    id: ObjectId;

    @Column()
    chapterName: string;

    @Column()
    zoneId: ObjectId;

    @Column()
    regionId: ObjectId;

    @Column()
    edId: ObjectId;

    @Column()
    rdId: ObjectId;

    @Column()
    createdDate: Date;

    @Column()
    location: string;

    @Column()
    weekday: Weekday;

    @Column()
    meetingType: MeetingType;

    @Column(() => ObjectId)
    badgeIds?: ObjectId[];

    @Column({ default: 1 })
    isActive: number;

    @Column({ default: 0 })
    isDelete: number;

    @Column(() => ObjectId)
    createdBy: ObjectId;

    @Column(() => ObjectId)
    updatedBy: ObjectId;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}

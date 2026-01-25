import {
    Entity,
    ObjectIdColumn,
    ObjectId,
    Column,
    CreateDateColumn,
    UpdateDateColumn
} from "typeorm";
import { MeetingType, Weekday } from "../enum/chapter";

@Entity("chapters")
export class Chapter {
    @ObjectIdColumn()
    id: ObjectId;

    @Column()
    chapterName: string;

    @Column()
    country: string;

    @Column()
    state: string;

    @Column(() => ObjectId)
    zoneId: ObjectId;

    @Column(() => ObjectId)
    regionId: ObjectId;

    @Column(() => ObjectId)
    edId: ObjectId;

    @Column(() => ObjectId)
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

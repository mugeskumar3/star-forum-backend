import {
  Entity,
  ObjectIdColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { ObjectId } from "mongodb";

@Entity("star_updates")
export class StarUpdate {
  @ObjectIdColumn()
  _id: ObjectId;

  @Column()
  chapterIds: ObjectId[]; // MULTI chapters

  @Column()
  categoryIds: ObjectId[]; // MULTI categories

  @Column()
  title: string;

  @Column()
  lastDate: Date;

  @Column()
  details: string;

  @Column()
  location: string;

  @Column({ default: 1 })
  isActive: number;

  @Column({ default: 0 })
  isDelete: number;

  @Column()
  createdBy: ObjectId;

  @Column()
  updatedBy: ObjectId;

  @CreateDateColumn()
  createdAt: Date;

  @Column("simple-json", { nullable: true })
  image?: {
    fileName?: string;
    path?: string;
    originalName?: string;
  };

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: "json", nullable: true })
  responses: {
    userId: ObjectId;
    type: string;
    respondedAt: Date;
  }[];
}

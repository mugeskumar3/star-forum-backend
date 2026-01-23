import {
  Entity,
  ObjectIdColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn
} from "typeorm";
import { ObjectId } from "mongodb";
import { TrainingStatus } from "../enum/TrainingStatus";

@Entity()
export class Training {
  @ObjectIdColumn()
  id: ObjectId;

  @Column()
  trainingId: string;

  @Column()
  chapterIds: ObjectId[];

  @Column()
  title: string;

  @Column()
  description: string;

  @Column()
  trainerIds: ObjectId[];

  @Column()
  trainingDateTime: Date;

  @Column()
  lastDateForApply: Date;

  @Column()
  duration: string;

  @Column()
  mode: "online" | "in-person";

  @Column()
  locationOrLink: string;

  @Column()
  maxAllowed: number;

  @Column({
    default: TrainingStatus.UPCOMING
  })
  status: TrainingStatus;

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

  @UpdateDateColumn()
  updatedAt: Date;
}

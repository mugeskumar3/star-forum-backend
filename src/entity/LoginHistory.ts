// src/entity/LoginHistory.ts
import {
  Entity,
  ObjectIdColumn,
  Column,
  CreateDateColumn
} from "typeorm";
import { ObjectId } from "mongodb";

@Entity("login_histories")
export class LoginHistory {

  @ObjectIdColumn()
  id: ObjectId;

  @Column()
  userId: ObjectId;

  @Column()
  userType: "ADMIN" | "ADMIN_USER";

  @Column()
  userName: string;

  @Column()
  phoneNumber: string;

  @Column()
  deviceName: string;     // Samsung SM-A125F / Apple iPhone

  @Column()
  browserName: string;    // Android App / iOS App / Chrome 120

  @Column()
  currentLocation: string;

  @Column()
  ipAddress: string;

  @Column()
  status: "SUCCESS" | "FAILED";

  @CreateDateColumn()
  loginAt: Date;
}

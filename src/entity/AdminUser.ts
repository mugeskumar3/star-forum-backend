import { Entity, ObjectIdColumn,Column, CreateDateColumn, UpdateDateColumn } from "typeorm"
import { ObjectId } from "mongodb";
@Entity()
export class AdminUser {

    @ObjectIdColumn()
    id: ObjectId

    @Column()
    name: string

    @Column()
    email: string

    @Column()
    companyName: string

    @Column()
    phoneNumber: string

    @Column()
    pin: string

    @Column()
    roleId: ObjectId

    @Column()
    createdBy: ObjectId;

    @Column()
    updatedBy: ObjectId;
    
    @Column({ default: 1 })
    isActive: number

    @Column({ default: 0 })
    isDelete: number

    @CreateDateColumn()
    createdAt: Date

    @UpdateDateColumn()
    updatedAt: Date

}

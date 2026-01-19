import { Entity, ObjectIdColumn, ObjectId, Column, CreateDateColumn, UpdateDateColumn } from "typeorm"

@Entity()
export class Admin {

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

    @ObjectIdColumn()
    roleId: ObjectId

    @Column({ default: 1 })
    isActive: number

    @Column({ default: 0 })
    isDelete: number

    @CreateDateColumn()
    createdAt: Date

    @UpdateDateColumn()
    updatedAt: Date

}

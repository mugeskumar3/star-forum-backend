// entity/Role.ts
import {
    Entity,
    ObjectIdColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index
} from "typeorm";
import { ObjectId } from "mongodb";

@Entity("roles")
export class Role {
    @ObjectIdColumn()
    _id: ObjectId;

    @Index({ unique: true })
    @Column()
    name: string;

    @Index({ unique: true })
    @Column()
    code: string;

    @Column({ default: 1 })
    isActive: number;

    @Column({ default: 0 })
    isDelete: number;

    @Column("json")
    permissions: {
        moduleId: ObjectId;     // 🔥 reference Modules
        actions: {
            view: boolean;
            add: boolean;
            edit: boolean;
            delete: boolean;
        };
    }[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @Column()
    createdBy: ObjectId;

    @Column()
    updatedBy: ObjectId;
}

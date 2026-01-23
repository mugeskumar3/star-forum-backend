import {
    Entity,
    ObjectIdColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index
} from "typeorm";
import { ObjectId } from "mongodb";

@Entity("products")
export class Product {

    @ObjectIdColumn()
    id: ObjectId;

    @Column()
    productName: string;

    @Column("double")
    price: number;
    
    @Index()
    @Column()
    categoryId: ObjectId; // Reference to category collection

    @Column("simple-json", { nullable: true })
    productImage?: {
        imageName?: string;
        imagePath?: string;
        originalName?: string;
    };

    @Column({ nullable: true })
    description?: string;

    @Column({ default: 1 })
    isActive: number;

    @Column({ default: 0 })
    isDelete: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @Column({ nullable: true })
    createdBy?: ObjectId;

    @Column({ nullable: true })
    updatedBy?: ObjectId;
}

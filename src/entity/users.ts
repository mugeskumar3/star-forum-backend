
import { Entity, ObjectIdColumn, ObjectId, Column } from "typeorm"

@Entity()
export class emploe {

    @ObjectIdColumn()
    id: ObjectId | undefined

    @Column()
    firstName: string | undefined

    @Column()
    lastName: string | undefined

    @Column()
    age: number | undefined

}

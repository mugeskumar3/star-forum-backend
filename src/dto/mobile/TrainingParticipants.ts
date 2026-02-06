import {
    IsArray,
    IsMongoId,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    IsEmail
} from "class-validator";

export class CreateTrainingMember {

    @IsString()
    @IsNotEmpty()
    status: string;

    @IsMongoId()
    trainingId: string;
}

import {
    IsArray,
    IsMongoId,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    IsEmail
} from "class-validator";

export class CreatePowerDateDto {
    @IsArray()
    @IsMongoId({ each: true })
    @IsNotEmpty()
    members: string[];

    @IsString()
    @IsNotEmpty()
    meetingStatus: string;

    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    phoneNumber: string;

    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    address: string;

    @IsNumber()
    rating: number;

    @IsString()
    @IsOptional()
    comments?: string;
}

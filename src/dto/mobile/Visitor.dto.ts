import {
    IsEnum,
    IsMongoId,
    IsNotEmpty,
    IsOptional,
    IsString,
    Length
} from "class-validator";
export enum VisitorStatus {
    YES = "YES",
    MAY_BE = "MAY_BE",
    NO = "NO"
}
export class CreateVisitorDto {
    @IsString()
    @IsNotEmpty()
    visitorName: string;

    @IsString()
    @Length(10, 15)
    contactNumber: string;

    @IsString()
    businessCategory: string;

    @IsString()
    companyName: string;

    @IsString()
    visitorDate: Date;

    @IsString()
    email: string;

    @IsMongoId()
    @IsString()
    chapterId: string;

    @IsString()
    status: string
}

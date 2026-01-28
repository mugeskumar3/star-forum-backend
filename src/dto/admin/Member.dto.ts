import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsEmail,
    IsMongoId,
    IsBoolean,
    IsArray,
    ValidateNested,
    IsDate,
    IsNumber,
    IsIn,
} from "class-validator";
import { Type } from "class-transformer";
import { ObjectId } from "mongodb";

// ------------------------------
// OFFICE ADDRESS DTO
// ------------------------------
export class OfficeAddressDto {
    @IsString()
    @IsNotEmpty()
    doorNo: string;

    @IsString()
    @IsOptional()
    oldNo?: string;

    @IsString()
    @IsNotEmpty()
    street: string;

    @IsString()
    @IsOptional()
    area?: string;

    @IsString()
    @IsNotEmpty()
    city: string;

    @IsString()
    @IsNotEmpty()
    state: string;

    @IsString()
    @IsNotEmpty()
    pincode: string;
}

// ------------------------------
// TRAINING DTO
// ------------------------------
export class TrainingDto {
    @IsString()
    year: string;

    @IsString()
    type: string;
}

// ------------------------------
// AWARD DTO
// ------------------------------
export class AwardDto {
    @IsString()
    tenure: string;

    @IsString()
    award: ObjectId;
}

// ------------------------------
// CREATE MEMBER DTO
// ------------------------------
export class CreateMemberDto {

    // BASIC INFORMATION
    @IsOptional()
    profileImage?: {
        fileName?: string;
        path?: string;
        originalName?: string;
    } = {
            fileName: "",
            path: "",
            originalName: ""
        };


    @IsString()
    @IsNotEmpty()
    fullName: string;

    @IsString()
    @IsNotEmpty()
    phoneNumber: string;

    @IsEmail()
    email: string;

    @IsString()
    @IsNotEmpty()
    companyName: string;

    @IsString()
    membershipId: string;

    @IsMongoId()
    region: string;

    @IsMongoId()
    chapter: string;

    @IsString()
    position: string;

    @IsMongoId()
    businessCategory: string;

    @IsMongoId()
    referredBy: string;

    @Type(() => Date)
    @IsDate()
    dateOfBirth: Date;

    @Type(() => Date)
    @IsDate()
    anniversary: Date;

    // OFFICE ADDRESS
    @ValidateNested()
    @Type(() => OfficeAddressDto)
    officeAddress: OfficeAddressDto;

    @IsBoolean()
    @IsOptional()
    isWantSmsEmailUpdates?: boolean;

    // SUBSCRIPTION
    @IsNumber()
    @Type(() => Number)
    annualFee: number;

    @IsString()
    paymentMode: string;

    @IsString()
    transactionId: string;

    @Type(() => Date)
    @IsDate()
    paymentDate: Date;

    @Type(() => Date)
    @IsDate()
    joiningDate: Date;

    @Type(() => Date)
    @IsDate()
    renewalDate: Date;

    @IsString()
    gstNumber: string;

    @IsBoolean()
    @IsOptional()
    sendWelcomeSms?: boolean;

    // TRAINING REPORT
    @IsString()
    trainingYear: string;

    @IsArray()
    @IsIn(["MRP", "MTP", "ATP"], { each: true })
    trainingTypes: string[];

    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => TrainingDto)
    trainings?: TrainingDto[];

    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => AwardDto)
    awards?: AwardDto[];

    // CLUB MEMBER
    @IsString()
    @IsIn(["Gold", "Diamond", "Platinum"])
    clubMemberType: string;
}
export class UpdateMemberDto {

    @IsOptional()
    @IsString()
    profileImage?: {
        fileName?: string;
        path?: string;
        originalName?: string;
    };

    @IsOptional()
    @IsString()
    fullName?: string;

    @IsOptional()
    @IsString()
    phoneNumber?: string;

    @IsOptional()
    @IsEmail()
    email?: string;

    @IsOptional()
    @IsString()
    companyName?: string;

    @IsOptional()
    @IsString()
    membershipId?: string;

    @IsOptional()
    @IsMongoId()
    region?: string;

    @IsOptional()
    @IsMongoId()
    chapter?: string;

    @IsOptional()
    @IsString()
    position?: string;

    @IsOptional()
    @IsMongoId()
    businessCategory?: string;

    @IsOptional()
    @IsMongoId()
    referredBy?: string;

    @IsOptional()
    @Type(() => Date)
    @IsDate()
    dateOfBirth?: Date;

    @IsOptional()
    @Type(() => Date)
    @IsDate()
    anniversary?: Date;

    @IsOptional()
    @ValidateNested()
    @Type(() => OfficeAddressDto)
    officeAddress?: OfficeAddressDto;

    @IsOptional()
    @IsBoolean()
    isWantSmsEmailUpdates?: boolean;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    annualFee?: number;

    @IsOptional()
    @IsString()
    paymentMode?: string;

    @IsOptional()
    @IsString()
    transactionId?: string;

    @IsOptional()
    @Type(() => Date)
    @IsDate()
    paymentDate?: Date;

    @IsOptional()
    @Type(() => Date)
    @IsDate()
    joiningDate?: Date;

    @IsOptional()
    @Type(() => Date)
    @IsDate()
    renewalDate?: Date;

    @IsOptional()
    @IsString()
    gstNumber?: string;

    @IsOptional()
    @IsBoolean()
    sendWelcomeSms?: boolean;

    @IsOptional()
    @IsString()
    trainingYear?: string;

    @IsOptional()
    @IsArray()
    @IsIn(["MRP", "MTP", "ATP"], { each: true })
    trainingTypes?: string[];

    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => TrainingDto)
    trainings?: TrainingDto[];

    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => AwardDto)
    awards?: AwardDto[];

    @IsOptional()
    @IsString()
    @IsIn(["Gold", "Diamond", "Platinum"])
    clubMemberType?: string;

    @IsOptional()
    @IsMongoId()
    updatedBy?: string;
}

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
import { Transform, Type } from "class-transformer";
import { ObjectId } from "mongodb";

export class OfficeAddressDto {
    @IsString()
    @IsOptional()
    doorNo: string;

    @IsString()
    @IsOptional()
    oldNo?: string;

    @IsString()
    @IsOptional()
    street: string;

    @IsString()
    @IsOptional()
    area?: string;

    @IsString()
    @IsOptional()
    city: string;

    @IsString()
    @IsOptional()
    state: string;

    @IsString()
    @IsOptional()
    pincode: string;
}

export class TrainingDto {
    @IsString()
    year: string;

    @IsString()
    type: string;
}

export class AwardDto {
    @IsOptional()
    @Transform(({ value }) => value === null ? undefined : value)
    @Type(() => Date)
    @IsDate()
    tenure: Date;

    @IsString()
    award: ObjectId;
}

export class CreateMemberDto {

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

    @IsOptional()
    @IsMongoId({ message: "region must be valid ObjectId" })
    region?: string;

    @IsOptional()
    @IsMongoId({ message: "chapter must be valid ObjectId" })
    chapter?: string;

    @IsString()
    position: string;

    @IsOptional()
    @IsMongoId()
    businessCategory: string;

    @IsOptional()
    @IsMongoId()
    referredBy: string;

    @Type(() => Date)
    @IsDate()
    dateOfBirth: Date;

    @IsOptional()
    @Transform(({ value }) => value === null ? undefined : value)
    @Type(() => Date)
    @IsDate()
    anniversary: Date;

    @IsOptional()
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

    @IsString()
    roleId: ObjectId
    // CLUB MEMBER
    @IsString()
    @IsIn(["Gold", "Diamond", "Platinum"])
    clubMemberType: string;
}
export class UpdateMemberDto {

    @IsOptional()
    profileImage?: {
        fileName?: string;
        path?: string;
        originalName?: string;
    };

    @IsString()
    roleId: ObjectId

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

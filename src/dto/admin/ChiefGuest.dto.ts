import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsMobilePhone,
  IsMongoId,
  IsOptional
} from "class-validator";

export class CreateChiefGuestDto {

  @IsNotEmpty()
  @IsString()
  chiefGuestName: string;

  @IsNotEmpty()
  contactNumber: string;

  @IsNotEmpty()
  @IsEmail()
  emailId: string;

  @IsNotEmpty()
  @IsString()
  businessName: string;

  // ✅ MUST BE STRING
  @IsNotEmpty()
  @IsMongoId()
  businessCategory: string;

  @IsNotEmpty()
  @IsString()
  location: string;

  // ✅ MUST BE STRING
  @IsNotEmpty()
  @IsMongoId()
  referredBy: string;

  @IsNotEmpty()
  @IsString()
  address: string;

  @IsOptional()
  isActive?: number;
}

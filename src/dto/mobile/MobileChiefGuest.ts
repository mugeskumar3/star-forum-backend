import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from "class-validator";
export enum VisitorStatus {
  YES = "YES",
  MAY_BE = "MAY_BE",
  NO = "NO",
  APPROVE = "Approve",
  REJECT = "Reject",
  PENDING = "Pending",
}
export class CreateMobileChiefGuestDto {
  @IsString()
  @IsNotEmpty()
  chiefGuestName: string;

  @IsString()
  @Length(10, 15)
  contactNumber: string;

  @IsString()
  businessCategory: string;
  @IsString()
  businessName: string;
  @IsString()
  email: string;

  @IsString()
  address: string;
  @IsOptional()
  @IsEnum(VisitorStatus)
  status?: VisitorStatus;
}

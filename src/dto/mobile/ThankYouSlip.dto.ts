import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min
} from "class-validator";

export class CreateThankYouSlipDto {
  // 🔹 Thank to (Receiver Id)
  @IsMongoId()
  @IsNotEmpty()
  thankTo: string;

  // 🔹 Business Type
  @IsEnum(["New", "Repeat"])
  businedsType: "New" | "Repeat";

  // 🔹 Referral Type
  @IsEnum(["Tier3+", "Outside", "Inside"])
  referralType: "Tier3+" | "Outside" | "Inside";

  // 🔹 Amount
  @IsNumber()
  @Min(0)
  amount: number;

  // 🔹 Comments
  @IsString()
  @IsOptional()
  comments?: string;
}

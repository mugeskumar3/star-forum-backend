import { IsMongoId } from "class-validator";

// ------------------------------
// CREATE ORDER DTO
// ------------------------------
export class CreateOrderDto {

  // LOCATION
  @IsMongoId()
  zoneId: string;

  @IsMongoId()
  regionId: string;

  @IsMongoId()
  chapterId: string;

  // MEMBER
  @IsMongoId()
  memberId: string;

  // PRODUCT
  @IsMongoId()
  productId: string;
}

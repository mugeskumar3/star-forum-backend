import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsMongoId,
    IsNumber,
    Min,
    IsBoolean
} from "class-validator";
import { Type } from "class-transformer";

// ------------------------------
// CREATE PRODUCT DTO
// ------------------------------
export class CreateProductDto {

    // BASIC DETAILS
    @IsString()
    @IsNotEmpty()
    productName: string;

    @Type(() => Number)
    @IsNumber()
    @Min(0)
    price: number;

    @IsMongoId()
    categoryId: string;

    // Image path (uploaded separately)
    @IsOptional()
    productImage: {
        imageName?: string;
        imagePath?: string;
        originalName?: string;
    } = {
            imageName: "",
            imagePath: "",
            originalName: ""
        };

    @IsOptional()
    @IsString()
    description?: string;

    // STATUS
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;


}

// ------------------------------
// UPDATE PRODUCT DTO
// ------------------------------
export class UpdateProductDto {

    @IsOptional()
    @IsString()
    productName?: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    price?: number;

    @IsOptional()
    @IsMongoId()
    categoryId?: string;

    @IsOptional()
    productImage: {
        imageName?: string;
        imagePath?: string;
        originalName?: string;
    } = {
            imageName: "",
            imagePath: "",
            originalName: ""
        };

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @IsMongoId()
    updatedBy?: string;
}

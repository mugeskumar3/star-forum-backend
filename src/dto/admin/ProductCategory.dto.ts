import { Type } from "class-transformer";
import { IsString, IsOptional } from "class-validator";

export class CreateProductCategoryDto {
    @IsString()
    name: string;

    @IsOptional()
    categoryImage: {
        imageName?: string;
        imagePath?: string;
        originalName?: string;
    } = {
            imageName: "",
            imagePath: "",
            originalName: ""
        };

    @IsOptional()
    @Type(() => Number)
    isActive?: number;
}

export class UpdateProductCategoryDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    categoryImage: {
        imageName?: string;
        imagePath?: string;
        originalName?: string;
    } = {
            imageName: "",
            imagePath: "",
            originalName: ""
        };

    @IsOptional()
    @Type(() => Number)
    isActive?: number;

    @IsOptional()
    @Type(() => Number)
    isDelete?: number;
}

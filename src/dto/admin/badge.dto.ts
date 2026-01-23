import { Type } from "class-transformer";
import { IsString, IsOptional, IsNumber, IS_ENUM } from "class-validator";
import { BadgeType } from "../../enum/badges";

export class CreateBadgeDto {
    @IsString()
    name: string;

    @IsOptional()
    badgeImage: {
        imageName?: string;
        imagePath?: string;
        originalName?: string;
    } = {
            imageName: "",
            imagePath: "",
            originalName: ""
        };

    @IsString()
    type?: BadgeType;

    @IsOptional()
    @Type(() => Number)
    isActive?: number;

    @IsOptional()
    @Type(() => Number)
    isDelete?: number;
}

export class UpdateBadgeDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    badgeImage: {
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

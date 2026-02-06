import {
    IsArray,
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsString,
    IsDateString,
    IsOptional,
    Min
} from "class-validator";
import { TrainingStatus } from "../../enum/TrainingStatus";
import { Type } from "class-transformer";

export class CreateTrainingDto {
    @IsArray()
    chapterIds: string[];

    @IsNotEmpty()
    @IsString()
    title: string;

    @IsOptional()
    @IsString()
    description: string;

    @IsNotEmpty()
      @IsNumber()
      @Min(0)
      trainingFee: number;

    @IsArray()
    trainerIds: string[];

    @IsDateString()
    trainingDateTime: string;

    @IsDateString()
    lastDateForApply: string;

    @IsNotEmpty()
    duration: string;

    @IsEnum(["online", "in-person"])
    mode: "online" | "in-person";

    @IsNotEmpty()
    locationOrLink: string;

    @IsNumber()
    @Type(() => Number)
    maxAllowed: number;

    @IsEnum(TrainingStatus)
    status: TrainingStatus;
}
export class UpdateTrainingDto {
    @IsOptional()
    chapterIds?: string[];

    @IsOptional()
    title?: string;

    @IsOptional()
    description?: string;

    @IsOptional()
    trainerIds?: string[];

    @IsOptional()
    trainingDateTime?: string;

    @IsOptional()
    lastDateForApply?: string;

    @IsOptional()
    duration?: string;

    @IsOptional()
    mode?: "online" | "in-person";

    @IsOptional()
    locationOrLink?: string;

    @IsOptional()
    maxAllowed?: number;

    @IsOptional()
    status?: TrainingStatus;

    @IsOptional()
    @Type(() => Number)
    isActive?: number;

    @IsOptional()
    @Type(() => Number)
    isDelete?: number;

    @IsNotEmpty()
      @IsNumber()
      @Min(0)
      trainingFee: number;

}
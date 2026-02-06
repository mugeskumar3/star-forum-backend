import { IsNotEmpty, IsString, MinLength } from "class-validator";

export class ChangePasswordDto {
    @IsString()
    @IsNotEmpty()
    oldPassword: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(4, { message: "Password must be at least 4 characters long" })
    newPassword: string;

    @IsString()
    @IsNotEmpty()
    confirmPassword: string;
}

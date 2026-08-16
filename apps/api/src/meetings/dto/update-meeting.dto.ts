import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsString,
  ValidateIf,
} from 'class-validator';

export class UpdateMeetingDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  title?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsDateString()
  date?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @IsString({ each: true })
  participants?: string[];
}

import {
  ArrayMaxSize,
  IsBoolean,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

// At least one of contactIds/rawEmails must resolve to a real recipient
// after dedup -- that combined check happens in the service (a real Contact
// might turn out to have no email on file), not here.
//
// The email itself comes from *either* a saved template (templateId) or an
// inline one-off written for this campaign (subject + bodyHtml). That's an
// XOR, which class-validator can't express cleanly either, so the service
// enforces it -- see BulkEmailService.resolveContent.
export class CreateBulkEmailDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsUUID()
  templateId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  subject?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  bodyHtml?: string;

  // Appends the campaign creator's own signature at send time.
  @IsOptional()
  @IsBoolean()
  appendSignature?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  contactIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  @IsEmail({}, { each: true })
  rawEmails?: string[];
}

import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsArray, Min, IsNumber } from 'class-validator';

const REPORT_TEMPLATES = ['executive_summary', 'revenue_health', 'operations_sla'] as const;
const REPORT_EXPORT_FORMATS = ['json', 'csv', 'pdf'] as const;

export class ReportQueryDto {
  @IsString()
  organizationId!: string;
}

export class GenerateReportDto {
  @IsString()
  organizationId!: string;

  @IsIn(REPORT_TEMPLATES)
  template!: (typeof REPORT_TEMPLATES)[number];
}

export class ExportReportDto {
  @IsString()
  organizationId!: string;

  @IsIn(REPORT_EXPORT_FORMATS)
  format!: (typeof REPORT_EXPORT_FORMATS)[number];
}

export class CreateReportScheduleDto {
  @IsString()
  organizationId!: string;

  @IsIn(REPORT_TEMPLATES)
  template!: (typeof REPORT_TEMPLATES)[number];

  @IsString()
  cronExpression!: string;

  @IsArray()
  @IsString({ each: true })
  channels!: string[];

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  maxRunsPerDay!: number;

  @IsOptional()
  @IsIn(REPORT_EXPORT_FORMATS)
  exportFormat?: (typeof REPORT_EXPORT_FORMATS)[number];
}

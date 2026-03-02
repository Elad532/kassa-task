import { createZodDto } from 'nestjs-zod';
import { productFilterSchema } from '@kassa-task/common';

export class ProductFilterDto extends createZodDto(productFilterSchema) {}

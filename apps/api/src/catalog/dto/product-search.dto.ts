import { createZodDto } from 'nestjs-zod';
import { productSearchSchema } from '@kassa-task/common';

export class ProductSearchDto extends createZodDto(productSearchSchema) {}

import { Controller, Get, Param, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { ProductFilterDto } from './dto/product-filter.dto';
import { ProductSearchDto } from './dto/product-search.dto';

@Controller('catalog/products')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  filter(@Query() dto: ProductFilterDto) {
    return this.catalogService.filter(dto);
  }

  // 'search' must be declared before ':id' to avoid NestJS routing conflict
  @Get('search')
  search(@Query() dto: ProductSearchDto) {
    return this.catalogService.search(dto);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.catalogService.findById(id);
  }
}

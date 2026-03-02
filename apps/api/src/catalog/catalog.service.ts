import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ProductDocument } from './schemas/product.schema';
import { ProductFilterDto } from './dto/product-filter.dto';
import { ProductSearchDto } from './dto/product-search.dto';

export const PRODUCT_MODEL = 'Product';

@Injectable()
export class CatalogService {
  constructor(
    @InjectModel(PRODUCT_MODEL)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  /**
   * Filter products by category, type, and/or price range.
   * Uses the compound Atlas index: { category: 1, type: 1, price: 1 }
   */
  async filter(dto: ProductFilterDto): Promise<ProductDocument[]> {
    const query: Record<string, unknown> = {};

    if (dto.category) query.category = dto.category;
    if (dto.type)     query.type = dto.type;

    if (dto.minPrice !== undefined || dto.maxPrice !== undefined) {
      query.price = {
        ...(dto.minPrice !== undefined && { $gte: dto.minPrice }),
        ...(dto.maxPrice !== undefined && { $lte: dto.maxPrice }),
      };
    }

    return this.productModel.find(query).lean().exec() as Promise<ProductDocument[]>;
  }

  /**
   * Full-text search across title and description.
   * Uses the Atlas text index: title (weight 2) + description (weight 1)
   */
  async search(dto: ProductSearchDto): Promise<ProductDocument[]> {
    return this.productModel
      .find({ $text: { $search: dto.q } })
      .limit(dto.limit)
      .lean()
      .exec() as Promise<ProductDocument[]>;
  }

  /**
   * Find a single product by its MongoDB ObjectId.
   * Uses the standard _id index.
   */
  async findById(id: string): Promise<ProductDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Invalid product id: "${id}"`);
    }
    const product = await this.productModel.findById(id).lean().exec();
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product as ProductDocument;
  }
}

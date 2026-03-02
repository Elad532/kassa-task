import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CatalogController } from './catalog.controller';
import { CatalogService, PRODUCT_MODEL } from './catalog.service';
import { ProductMongooseSchema } from './schemas/product.schema';

@Module({
  imports: [
    // Connection lives here — CatalogModule is self-contained.
    // AppModule has no MongoDB concern.
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env.MONGODB_URI,
        autoIndex: false,
        autoCreate: false,
      }),
    }),
    MongooseModule.forFeature([
      { name: PRODUCT_MODEL, schema: ProductMongooseSchema },
    ]),
  ],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}

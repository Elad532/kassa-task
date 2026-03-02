import { z } from 'zod';

// Entity shape — single source of truth for the Product entity.
// All downstream representations (Mongoose schema, NestJS DTO) are derived
// from this definition. Never declare these fields again elsewhere.
export const productZodSchema = z.object({
  title:       z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  category:    z.string().min(1, 'Category is required'),
  type:        z.string().min(1, 'Type is required'),
  price:       z.number().positive('Price must be positive (USD)'),
  width:       z.number().positive('Width must be positive (centimeters)'),
  height:      z.number().positive('Height must be positive (centimeters)'),
  depth:       z.number().positive('Depth must be positive (centimeters)'),
});

export type Product = z.infer<typeof productZodSchema>;

// Query schema for GET /api/catalog/products
// Aligned with Atlas compound index: { category: 1, type: 1, price: 1 }
export const productFilterSchema = z.object({
  category: z.string().min(1).optional(),
  type:     z.string().min(1).optional(),
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional(),
});

export type ProductFilter = z.infer<typeof productFilterSchema>;

// Query schema for GET /api/catalog/products/search
// Aligned with Atlas text index on title (weight 2) + description (weight 1)
export const productSearchSchema = z.object({
  q:     z.string().min(1, 'Search query is required'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ProductSearch = z.infer<typeof productSearchSchema>;

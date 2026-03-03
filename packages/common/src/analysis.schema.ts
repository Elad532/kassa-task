import { z } from 'zod';

// Shared base for every LLM-attributed value.
// confidence uses a 1–10 scale; 7 = genuinely acceptable.
export const ReasonedSchema = z.object({
  confidence: z.number().min(1).max(10),
  reasoning:  z.string().max(80),
});

export const StringAttributeSchema = ReasonedSchema.extend({
  value: z.string(),
});

export const DimensionsAttributeSchema = ReasonedSchema.extend({
  width_cm:  z.number().nullable(),
  height_cm: z.number().nullable(),
  depth_cm:  z.number().nullable(),
});

export const PriceRangeAttributeSchema = ReasonedSchema.extend({
  price_start: z.number().nullable(),
  price_end:   z.number().nullable(),
});

export const FurnitureAnalysisSchema = z.object({
  furniture_type:    StringAttributeSchema.nullable(),
  category:          StringAttributeSchema.nullable(),
  style_descriptors: z.array(StringAttributeSchema),
  materials:         z.array(StringAttributeSchema),
  color_palette:     z.array(StringAttributeSchema),
  dimensions:        DimensionsAttributeSchema.nullable(),
  price_range:       PriceRangeAttributeSchema.nullable(),
  // holistic confidence that the analysis is usable for retrieval
  overall:           ReasonedSchema,
});

// GuardrailResponseSchema extends Reasoned — consistent confidence shape across all LLM outputs.
// additional_subjects lists other clearly visible furniture items beyond the primary subject.
export const GuardrailResponseSchema = ReasonedSchema.extend({
  is_furniture:        z.boolean(),
  detected_subject:    z.string(),
  additional_subjects: z.array(z.string()),
});

export type Reasoned = z.infer<typeof ReasonedSchema>;
export type StringAttribute = z.infer<typeof StringAttributeSchema>;
export type DimensionsAttribute = z.infer<typeof DimensionsAttributeSchema>;
export type PriceRangeAttribute = z.infer<typeof PriceRangeAttributeSchema>;
export type FurnitureAnalysis = z.infer<typeof FurnitureAnalysisSchema>;
export type GuardrailResponse = z.infer<typeof GuardrailResponseSchema>;

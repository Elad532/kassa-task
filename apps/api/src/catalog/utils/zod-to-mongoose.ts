import { z } from 'zod';
import { Schema, SchemaDefinition } from 'mongoose';

type MongooseFieldDef = {
  type: typeof String | typeof Number | typeof Boolean | typeof Date | (typeof String)[] | (typeof Number)[];
  required: boolean;
};

/**
 * Converts a Zod field type to a Mongoose schema field definition.
 * Supported types: ZodString, ZodNumber, ZodBoolean, ZodDate, ZodArray,
 * ZodOptional (wrapping any supported type), ZodNullable (wrapping any supported type).
 * Throws for any unsupported type to keep the schema honest.
 */
function zodFieldToMongoose(type: z.ZodTypeAny): MongooseFieldDef {
  if (type instanceof z.ZodString) return { type: String, required: true };
  if (type instanceof z.ZodNumber) return { type: Number, required: true };
  if (type instanceof z.ZodBoolean) return { type: Boolean, required: true };
  if (type instanceof z.ZodDate) return { type: Date, required: true };
  if (type instanceof z.ZodArray) {
    const inner = zodFieldToMongoose(type.element as z.ZodTypeAny);
    return { type: [inner.type] as (typeof String)[] | (typeof Number)[], required: true };
  }
  if (type instanceof z.ZodOptional) {
    return { ...zodFieldToMongoose(type.unwrap() as z.ZodTypeAny), required: false };
  }
  if (type instanceof z.ZodNullable) {
    return { ...zodFieldToMongoose(type.unwrap() as z.ZodTypeAny), required: false };
  }
  throw new Error(
    `zodToMongooseSchema: unsupported Zod type "${type.constructor.name}". ` +
    `Extend this utility if you need additional types.`,
  );
}

/**
 * Derives a Mongoose Schema from a Zod object schema.
 * Fields are declared once in Zod — this utility generates the Mongoose
 * schema definition automatically so there is no duplication.
 *
 * @param zodObj  A z.object() schema (top-level shape only; no nested objects)
 * @param options Standard Mongoose SchemaOptions (collection, autoIndex, etc.)
 */
export function zodToMongooseSchema(
  zodObj: z.ZodObject<z.ZodRawShape>,
  options?: ConstructorParameters<typeof Schema>[1],
): Schema<any> {
  const definition: SchemaDefinition = {};
  for (const [key, type] of Object.entries(zodObj.shape)) {
    definition[key] = zodFieldToMongoose(type as z.ZodTypeAny);
  }
  return new Schema<any>(definition, options);
}

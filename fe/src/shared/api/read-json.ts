import type { z } from "zod";

export async function readJson<TSchema extends z.ZodType>(
  response: Response,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  const value: unknown = await response.json();
  return schema.parse(value);
}

export function readJsonText<TSchema extends z.ZodType>(
  text: string,
  schema: TSchema,
): z.infer<TSchema> {
  const value: unknown = JSON.parse(text);
  return schema.parse(value);
}

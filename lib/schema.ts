import { z } from "zod";
import { EXTRAS, STYLES, WALLS, type Spec } from "./types";

export const SpecSchema = z.object({
  style: z.enum(STYLES),
  guests: z.int().min(1).max(1000),
  stage: z.enum(WALLS),
  bar: z.enum(WALLS),
  extras: z.array(z.enum(EXTRAS)),
  accessible: z.boolean(),
}) satisfies z.ZodType<Spec>;

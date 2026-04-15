import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const caseStudies = defineCollection({
  loader: glob({
    pattern: "**/*.mdx",
    base: "./src/content/case-studies",
  }),
  schema: z.object({
    title: z.string(),
    outcome: z.string(),
    summary: z.string(),
    stack: z.array(z.string()),
    order: z.number(),
    role: z.string().optional(),
    year: z.string().optional(),
    company: z.string().optional(),
  }),
});

export const collections = { caseStudies };

import { z } from "zod";

export const createGameSessionSchema = z.object({
  mode: z.enum(["practice", "daily"]).default("practice")
});

export const sessionParamsSchema = z.object({
  sessionId: z.string().uuid()
});

export const submitAttemptSchema = z.object({
  sessionId: z.string().uuid(),
  roundId: z.string().uuid(),
  source: z
    .string()
    .min(1, "Submission is required.")
    .max(12000, "Submission exceeds Typst source limit.")
});

export const skipRoundSchema = z.object({
  sessionId: z.string().uuid(),
  roundId: z.string().uuid()
});

export const previewRenderSchema = z.object({
  source: z.string().min(1).max(12000),
  inputMode: z.enum(["math", "text"]).default("math"),
  sessionId: z.string().uuid().optional(),
  roundId: z.string().uuid().optional()
}).superRefine((value, ctx) => {
  const hasSessionId = Boolean(value.sessionId);
  const hasRoundId = Boolean(value.roundId);

  if (hasSessionId !== hasRoundId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "sessionId and roundId must be provided together.",
      path: hasSessionId ? ["roundId"] : ["sessionId"]
    });
  }
});

export const authRegisterSchema = z.object({
  username: z.string().min(3).max(40).regex(/^[a-zA-Z0-9_-]+$/),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  displayName: z.string().min(2).max(80).optional()
});

export const authLoginSchema = z.object({
  identifier: z.string().min(3).max(255),
  password: z.string().min(8).max(128)
});

export const authHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(5)
});

export const enqueueRenderCheckSchema = z.object({
  submissionId: z.string().uuid(),
  roundId: z.string().uuid(),
  source: z.string(),
  canonicalSource: z.string(),
  canonicalSvg: z.string(),
  acceptedAlternates: z.array(z.string()).default([])
});

export type CreateGameSessionInput = z.infer<typeof createGameSessionSchema>;
export type SubmitAttemptInput = z.infer<typeof submitAttemptSchema>;
export type EnqueueRenderCheckInput = z.infer<typeof enqueueRenderCheckSchema>;

export const challengeContentCategorySchema = z.enum([
  "basic-math",
  "fractions",
  "superscripts-subscripts",
  "matrices",
  "alignment-layout",
  "symbols",
  "text-formatting",
  "mixed-expressions"
]);

export const challengeContentSchema = z
  .object({
    id: z.string().min(3).max(80),
    title: z.string().min(3).max(160),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    difficulty: z.enum(["easy", "medium", "hard"]),
    category: challengeContentCategorySchema,
    tags: z.array(z.string().min(2).max(40)).min(1).max(8),
    canonical_typst_source: z.string().min(1).max(4000),
    accepted_alternate_sources: z.array(z.string().min(1).max(4000)).max(8),
    target_render_svg: z.string().min(1).nullable(),
    target_render_hash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
    estimated_solve_time: z.number().int().min(5).max(300),
    hint: z.string().min(3).max(240),
    explanation: z.string().min(8).max(1200),
    status: z.enum(["active", "inactive"])
  })
  .superRefine((challenge, ctx) => {
    const canonical = challenge.canonical_typst_source.trim();
    const seen = new Set<string>();

    for (const [index, alternate] of challenge.accepted_alternate_sources.entries()) {
      const normalized = alternate.trim();

      if (normalized === canonical) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["accepted_alternate_sources", index],
          message: "Alternate sources should not duplicate canonical source."
        });
      }

      if (seen.has(normalized)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["accepted_alternate_sources", index],
          message: "Alternate sources must be unique."
        });
      }

      seen.add(normalized);
    }

    if ((challenge.target_render_svg === null) !== (challenge.target_render_hash === null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["target_render_svg"],
        message: "SVG and render hash must either both be present or both be null."
      });
    }
  });

export const challengeContentPackSchema = z
  .object({
    version: z.number().int().min(1),
    pack: z.object({
      id: z.string().min(3).max(80),
      title: z.string().min(3).max(120),
      description: z.string().min(8).max(500)
    }),
    challenges: z.array(challengeContentSchema).min(1)
  })
  .superRefine((pack, ctx) => {
    const ids = new Set<string>();
    const slugs = new Set<string>();

    for (const [index, challenge] of pack.challenges.entries()) {
      if (ids.has(challenge.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["challenges", index, "id"],
          message: "Challenge ids must be unique within a pack."
        });
      }

      if (slugs.has(challenge.slug)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["challenges", index, "slug"],
          message: "Challenge slugs must be unique within a pack."
        });
      }

      ids.add(challenge.id);
      slugs.add(challenge.slug);
    }
  });

export type ChallengeContentInput = z.infer<typeof challengeContentSchema>;
export type ChallengeContentPackInput = z.infer<typeof challengeContentPackSchema>;

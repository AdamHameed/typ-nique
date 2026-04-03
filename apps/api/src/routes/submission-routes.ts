import type { FastifyInstance } from "fastify";
import { submitAttemptSchema } from "@typ-nique/validation";
import { submitAttempt } from "../services/submission-service.js";

export async function submissionRoutes(app: FastifyInstance) {
  app.post("/api/v1/submissions", async (request, reply) => {
    const body = submitAttemptSchema.parse(request.body);
    const result = await submitAttempt(body);

    return reply.code(200).send({ data: result });
  });
}

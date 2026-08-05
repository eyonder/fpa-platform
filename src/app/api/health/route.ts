import { handleRoute, ok } from "@/backend/core/http";

export const GET = handleRoute(async () =>
  ok({ status: "up", at: new Date().toISOString() }),
);

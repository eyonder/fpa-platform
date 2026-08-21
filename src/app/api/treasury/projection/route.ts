import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { treasuryProjectionService } from "@/backend/modules/treasury/treasury-projection.service";
import { treasuryProjectionQuerySchema } from "@/backend/modules/treasury/treasury-simulation.schema";

/**
 * İNCE CONTROLLER.
 * GET /api/treasury/projection?scenarioId=&startDate=&horizonDays=&granularity=
 *     &includeSales=&includeCapex=&includePayroll=&includePipeline=
 *
 * Taban çizgi = `adjustments: []` ile AYNI motor (bkz.
 * treasury-projection.service.ts). Yalnızca OKUMA — `treasury:read` her
 * rolde vardır (bkz. events/route.ts GET ile aynı gerekçe).
 */
export const GET = handleRoute((request: Request) =>
  withTenantContext(request, async (context) => {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const query = treasuryProjectionQuerySchema.parse(params);

    const flag = (value: "true" | "false" | undefined) =>
      value === undefined ? undefined : value === "true";

    return ok(
      await treasuryProjectionService.project(context, {
        scenarioId: query.scenarioId,
        startDate: query.startDate,
        horizonDays: query.horizonDays,
        granularity: query.granularity,
        displayCurrency: query.displayCurrency,
        includeDerived: {
          sales: flag(query.includeSales),
          capex: flag(query.includeCapex),
          payroll: flag(query.includePayroll),
          pipeline: flag(query.includePipeline),
        },
        adjustments: [],
      }),
    );
  }),
);

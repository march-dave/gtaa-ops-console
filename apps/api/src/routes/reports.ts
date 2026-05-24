import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { ApiError, EmbedToken, EmbedTokenRequest } from "@gtaa/contracts";

import type { Config } from "../config.js";

interface ReportsPluginOptions {
  config: Config;
}

/**
 * Power BI embed-token endpoint.
 *
 * Production flow (real implementation):
 *   1. Read POWERBI_WORKSPACE_ID, POWERBI_REPORT_ID, and the service principal
 *      credentials from Key Vault (via Managed Identity — no secrets in env).
 *   2. Acquire an AAD token for the Power BI Service using the service
 *      principal (MSAL Node or @azure/identity ClientSecretCredential).
 *   3. POST to https://api.powerbi.com/v1.0/myorg/groups/{workspaceId}/reports/{reportId}/GenerateToken
 *      with body { accessLevel: "View", identities: [{ username, roles, datasets }] }
 *      to get a short-lived embed token (RLS applied if identities provided).
 *   4. Return { reportId, embedUrl, token, expiresAt } — never persist.
 *
 * The mock below returns a non-functional placeholder so the FE contract is
 * exercised end-to-end without a real Power BI workspace. The FE renders a
 * placeholder that explains the pattern to the reviewer.
 */
const reportsRoutes = (
  { config }: ReportsPluginOptions
): FastifyPluginAsync => async (app) => {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    "/api/reports/embed-token",
    {
      schema: {
        tags: ["reports"],
        description:
          "Issue a Power BI embed token for the given report. Mocked unless POWERBI_REPORT_ID is configured.",
        body: EmbedTokenRequest,
        response: { 200: EmbedToken, 401: ApiError, 503: ApiError },
      },
    },
    async (req) => {
      app.requireAuth(req);

      const configuredReportId = config.POWERBI_REPORT_ID;
      const workspaceId = config.POWERBI_WORKSPACE_ID;

      if (!configuredReportId || !workspaceId) {
        // Demo mode: return a clearly-mock embed token so the FE can render a
        // placeholder. In prod with real config, this branch is dead code.
        const expires = new Date(Date.now() + 60 * 60_000).toISOString();
        return {
          reportId: req.body.reportId,
          embedUrl: `https://app.powerbi.com/reportEmbed?reportId=${req.body.reportId}&autoAuth=false`,
          token: "MOCK.embed.token.replace-with-real-via-service-principal",
          expiresAt: expires,
        };
      }

      // Real path would call Power BI REST GenerateToken here.
      throw app.httpErrors.serviceUnavailable(
        "Real Power BI embed not yet wired — see docs/adr/0006."
      );
    }
  );
};

export default reportsRoutes;

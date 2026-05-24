import { useMutation } from "@tanstack/react-query";
import { ExternalLink, Info } from "lucide-react";
import type { EmbedToken } from "@gtaa/contracts";

import { apiFetch } from "../lib/api";

const DEMO_REPORT_ID = "demo-kpi-report";

export function ReportsPage() {
  const issue = useMutation({
    mutationFn: () =>
      apiFetch<EmbedToken>("/api/reports/embed-token", {
        method: "POST",
        body: JSON.stringify({ reportId: DEMO_REPORT_ID }),
      }),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Reports (Power BI Embedded)</h1>
        <p className="text-sm text-slate-400">
          Executive KPI board. In production this embeds a Power BI report via a
          service-principal-issued token — see
          <code className="ml-1 text-slate-300">docs/adr/0006</code>.
        </p>
      </header>

      <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-4 w-4 text-brand-500" />
          <div className="text-xs leading-relaxed text-slate-400">
            <p>
              The API exposes <code className="text-slate-200">POST /api/reports/embed-token</code> which,
              in production, calls Power BI REST
              <code className="text-slate-200"> GenerateToken</code> using a
              service principal stored in Key Vault (accessed via Managed Identity).
              The token returned is short-lived and scoped to the requested report.
            </p>
            <p className="mt-1">
              In this demo we return a clearly-mock token so the contract is
              wired but the iframe below is a placeholder.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-300">
            Generate embed token
          </h2>
          <button
            type="button"
            onClick={() => issue.mutate()}
            disabled={issue.isPending}
            className="rounded bg-brand-500 px-3 py-1.5 text-xs text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {issue.isPending ? "Issuing…" : "POST /api/reports/embed-token"}
          </button>
        </div>

        {issue.data && (
          <pre className="overflow-x-auto rounded border border-slate-800 bg-slate-950/60 p-3 text-xs">
{JSON.stringify(issue.data, null, 2)}
          </pre>
        )}
        {issue.error && (
          <div className="rounded border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
            {(issue.error as Error).message}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-slate-300">Embed surface</h2>
        <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-950/30 text-sm text-slate-500">
          <div className="flex flex-col items-center gap-2 text-center">
            <ExternalLink className="h-6 w-6" />
            <div>
              <code className="text-slate-300">powerbi-client-react</code> would
              render the report here.
              <br />
              In production:{" "}
              <code className="text-slate-300">
                &lt;PowerBIEmbed embedConfig=&#123;&#123; type, id, embedUrl, accessToken, settings &#125;&#125; /&gt;
              </code>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

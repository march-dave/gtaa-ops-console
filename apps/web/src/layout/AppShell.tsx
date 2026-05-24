import { NavLink, Outlet } from "react-router-dom";
import {
  Activity,
  BarChart3,
  CheckSquare,
  ClipboardList,
  Database,
  Eye,
  LayoutDashboard,
  PieChart,
} from "lucide-react";
import { SelectField, selectIcons, type SelectOption } from "../components/SelectField";
import { useAuth, type MockKey } from "../auth/MockAuthProvider";

const NAV = [
  { to: "/forecast", label: "Passenger Forecast", icon: BarChart3 },
  { to: "/gate-approval", label: "Gate Approval", icon: CheckSquare },
  { to: "/apron-cv", label: "Apron CV", icon: Eye },
  { to: "/sensors", label: "Sensors", icon: Activity },
  { to: "/insights", label: "Insights (Fabric)", icon: Database },
  { to: "/reports", label: "Reports (PBI)", icon: PieChart },
  { to: "/audit", label: "Audit", icon: ClipboardList },
];

const ROLE_OPTIONS: SelectOption<MockKey>[] = [
  {
    value: "viewer",
    label: "Viewer",
    description: "Read-only access",
    icon: selectIcons.viewer,
  },
  {
    value: "duty",
    label: "Duty Manager",
    description: "Approve and resolve",
    icon: selectIcons.duty,
  },
  {
    value: "ops",
    label: "Ops Manager",
    description: "Full ops role",
    icon: selectIcons.ops,
  },
  {
    value: "none",
    label: "Signed out",
    description: "No API access",
    icon: selectIcons.none,
  },
];

export function AppShell() {
  const { user, mockKey, setMockKey } = useAuth();

  return (
    <div className="flex h-full">
      <aside className="w-60 shrink-0 border-r border-slate-800 bg-slate-900/80 p-4">
        <div className="mb-6 flex items-center gap-2 text-brand-500">
          <LayoutDashboard className="h-5 w-5" />
          <span className="text-sm font-semibold tracking-wide text-slate-100">
            GTAA OPS CONSOLE
          </span>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
                  isActive
                    ? "bg-brand-500/15 text-brand-500"
                    : "text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/40 px-6 py-3">
          <div className="text-sm text-slate-400">
            {user ? (
              <>
                <span className="text-slate-200">{user.displayName}</span>{" "}
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-300">
                  {user.roles.join(", ")}
                </span>
              </>
            ) : (
              <span>Not signed in</span>
            )}
          </div>
          <SelectField
            label="Mock access"
            value={mockKey}
            options={ROLE_OPTIONS}
            onChange={setMockKey}
            className="w-64"
            buttonClassName="min-h-11"
            menuClassName="w-72"
          />
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

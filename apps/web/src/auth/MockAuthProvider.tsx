import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Role, User } from "@gtaa/contracts";

interface AuthState {
  user: User | null;
  mockKey: MockKey;
  setMockKey: (key: MockKey) => void;
  hasRole: (role: Role) => boolean;
}

const ROLE_RANK: Record<Role, number> = {
  Viewer: 0,
  DutyManager: 1,
  OpsManager: 2,
};

export type MockKey = "viewer" | "duty" | "ops" | "none";

const MOCK_USERS: Record<Exclude<MockKey, "none">, User> = {
  viewer: {
    id: "mock-viewer",
    oid: "00000000-0000-0000-0000-000000000001",
    email: "viewer@gtaa.example",
    displayName: "Vera Viewer",
    roles: ["Viewer"],
  },
  duty: {
    id: "mock-duty",
    oid: "00000000-0000-0000-0000-000000000002",
    email: "duty@gtaa.example",
    displayName: "Dana Duty-Manager",
    roles: ["DutyManager"],
  },
  ops: {
    id: "mock-ops",
    oid: "00000000-0000-0000-0000-000000000003",
    email: "ops@gtaa.example",
    displayName: "Omar Ops-Manager",
    roles: ["OpsManager"],
  },
};

const STORAGE_KEY = "gtaa.mockUser";

const AuthContext = createContext<AuthState | null>(null);

export function MockAuthProvider({ children }: { children: ReactNode }) {
  const [mockKey, setMockKeyState] = useState<MockKey>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as MockKey | null;
    return stored ?? "duty";
  });

  const setMockKey = (key: MockKey): void => {
    localStorage.setItem(STORAGE_KEY, key);
    setMockKeyState(key);
  };

  const user = mockKey === "none" ? null : MOCK_USERS[mockKey];

  const value = useMemo<AuthState>(
    () => ({
      user,
      mockKey,
      setMockKey,
      hasRole: (role) =>
        user
          ? user.roles.some((r) => ROLE_RANK[r] >= ROLE_RANK[role])
          : false,
    }),
    [user, mockKey]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within MockAuthProvider");
  return ctx;
}

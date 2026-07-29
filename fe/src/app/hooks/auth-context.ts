import { createContext, useContext } from "react";

import type { RegisterInput } from "../lib/api/endpoints/auth";

export type Role = "BUYER" | "SELLER" | "ADMIN";

export interface AuthProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  username?: string;
}

export interface AuthState {
  ready: boolean;
  authenticated: boolean;
  token: string | undefined;
  profile: AuthProfile | undefined;
  roles: Role[];
  subject: string | undefined;
  login: (redirectTo?: string) => void;
  loginWithPassword: (username: string, password: string) => Promise<void>;
  beginOAuthLogin: (provider: "google" | "facebook", next?: string) => void;
  register: (input: RegisterInput) => Promise<void>;
  logout: (redirectTo?: string) => void;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

export function useHasRole(role: Role): boolean {
  return useAuth().roles.includes(role);
}

import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { takeHandoffFromUrl } from "../lib/hubHandoff";

export interface Company {
  id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: any | null;
  userRole: "super_admin" | "admin" | "employee" | null;
  userCompanies: Company[];
  activeCompanyId: string | null;
  loading: boolean;
  companiesLoading: boolean;
  sessionLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  register: (input: {
    email: string;
    password?: string;
    firstName?: string;
    lastName?: string;
    companyId?: string | null;
    employeeId?: string;
    roleName?: string;
    roleId?: string | null;
    isTemporaryPassword?: boolean;
  }) => Promise<{ userId: string; generatedPassword: string | null }>;
  updateUserAccount: (input: {
    authUserId?: string | null;
    employeeId?: string;
    firstName?: string;
    lastName?: string;
    companyId?: string | null;
    roleName?: string;
    roleId?: string | null;
    password?: string;
    isTemporaryPassword?: boolean;
  }) => Promise<{ userId: string }>;
  signOut: () => Promise<void>;
  fetchUserCompanies: () => Promise<void>;
  initialize: () => void;
  setActiveCompany: (companyId: string) => void;
  clearActiveCompany: () => void;
  isSuperAdmin: () => boolean;
}

const ACTIVE_COMPANY_KEY = "payroll_active_company_id";

const toAppRole = (roleName?: string) => {
  if (roleName === "super_admin") return "super_admin";
  if (roleName === "admin") return "admin";
  return "employee";
};

const generateTemporaryPassword = (length: number = 12) => {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  user: null,
  userRole: null,
  userCompanies: [],
  activeCompanyId: localStorage.getItem(ACTIVE_COMPANY_KEY) || null,
  loading: false,
  companiesLoading: false,
  sessionLoading: true,
  signIn: async (email: string, password: string) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      set({ isAuthenticated: true, user: data.user });
    } catch (error) {
      throw error;
    } finally {
      set({ loading: false });
    }
  },
  sendPasswordReset: async (email: string) => {
    const redirectTo = `${window.location.origin}/change-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) throw error;
  },
  register: async (input) => {
    const providedPassword = input.password || "";
    const generatedPassword = providedPassword || generateTemporaryPassword(12);
    const requiresPasswordChange =
      Boolean(input.isTemporaryPassword) || !providedPassword;
    const profileRole = input.roleName || "user";
    const role = toAppRole(input.roleName);

    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: generatedPassword,
      options: {
        data: {
          first_name: input.firstName || "",
          last_name: input.lastName || "",
          company_id: input.companyId || null,
          role,
          temporary_password: requiresPasswordChange,
          requires_password_change: requiresPasswordChange,
        },
      },
    });

    if (error) throw error;

    const userId = data.user?.id;
    if (!userId) {
      throw new Error("User account was not created by Supabase.");
    }

    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: userId,
        company_id: input.companyId || null,
        first_name: input.firstName || null,
        last_name: input.lastName || null,
        role: profileRole,
        role_id: input.roleId || null,
        is_deleted: false,
      },
      { onConflict: "id" },
    );

    if (profileError) throw profileError;

    if (input.employeeId) {
      const { error: employeeLinkError } = await supabase
        .from("employees")
        .update({ auth_user_id: userId })
        .eq("id", input.employeeId);

      if (employeeLinkError) throw employeeLinkError;
    }

    return {
      userId,
      generatedPassword: providedPassword ? null : generatedPassword,
    };
  },
  updateUserAccount: async (input) => {
    let userId = input.authUserId || null;

    if (!userId && input.employeeId) {
      const { data: employeeRow, error: employeeError } = await supabase
        .from("employees")
        .select("auth_user_id")
        .eq("id", input.employeeId)
        .maybeSingle();

      if (employeeError) throw employeeError;
      userId = employeeRow?.auth_user_id || null;
    }

    if (!userId) {
      throw new Error(
        "This employee has no linked auth account yet. Create an account first.",
      );
    }

    const profileRole = input.roleName || "user";
    const role = toAppRole(input.roleName);

    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: userId,
        company_id: input.companyId || null,
        first_name: input.firstName || null,
        last_name: input.lastName || null,
        role: profileRole,
        role_id: input.roleId || null,
        is_deleted: false,
      },
      { onConflict: "id" },
    );

    if (profileError) throw profileError;

    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (input.password) {
      if (currentUser?.id !== userId) {
        throw new Error(
          "Password update for another user is not supported from this client session.",
        );
      }

      const requiresPasswordChange = Boolean(input.isTemporaryPassword);
      const { error: passwordError } = await supabase.auth.updateUser({
        password: input.password,
        data: {
          temporary_password: requiresPasswordChange,
          requires_password_change: requiresPasswordChange,
          role,
        },
      });

      if (passwordError) throw passwordError;
      set((state) => ({
        user:
          state.user && state.user.id === userId
            ? {
                ...state.user,
                user_metadata: {
                  ...(state.user.user_metadata || {}),
                  temporary_password: requiresPasswordChange,
                  requires_password_change: requiresPasswordChange,
                  role,
                },
              }
            : state.user,
      }));
    }

    return { userId };
  },
  signOut: async () => {
    try {
      await supabase.auth.signOut();
      set({
        isAuthenticated: false,
        user: null,
        userRole: null,
        userCompanies: [],
        activeCompanyId: null,
      });
      localStorage.removeItem(ACTIVE_COMPANY_KEY);
    } catch (error) {
      throw error;
    }
  },
  fetchUserCompanies: async () => {
    set({ companiesLoading: true });
    try {
      const SUPER_ADMIN_EMAILS = ["kleinhans.esc@gmail.com"];

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("No authenticated user");

      const metaRole: string | undefined =
        user.app_metadata?.role ?? user.user_metadata?.role;

      let userRole: AuthState["userRole"] = null;
      if (
        metaRole === "super_admin" ||
        SUPER_ADMIN_EMAILS.includes(user.email ?? "")
      ) {
        userRole = "super_admin";
      } else if (metaRole === "admin") {
        userRole = "admin";
      } else {
        userRole = "employee";
      }

      let companies: Company[] = [];
      let activeCompanyId: string | null = null;

      if (userRole === "super_admin") {
        const { data: allCompanies, error: cErr } = await supabase
          .from("companies")
          .select("id, name, created_at, updated_at")
          .order("name", { ascending: true });
        if (cErr) throw cErr;

        companies = (allCompanies || []) as Company[];

        const currentActive = localStorage.getItem(ACTIVE_COMPANY_KEY);
        if (currentActive && companies.some((c) => c.id === currentActive)) {
          activeCompanyId = currentActive;
        } else {
          localStorage.removeItem(ACTIVE_COMPANY_KEY);
        }
      } else {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        const profileCompanyId = profile?.company_id ?? null;
        if (profileCompanyId) {
          const { data: company, error: companyError } = await supabase
            .from("companies")
            .select("id, name, created_at, updated_at")
            .eq("id", profileCompanyId)
            .maybeSingle();

          if (companyError) throw companyError;

          if (company) {
            companies = [company as Company];
            activeCompanyId = company.id;
          }
        }

        if (activeCompanyId) {
          localStorage.setItem(ACTIVE_COMPANY_KEY, activeCompanyId);
        } else {
          localStorage.removeItem(ACTIVE_COMPANY_KEY);
        }
      }

      set({ userRole, userCompanies: companies, activeCompanyId });
    } catch (error) {
      console.error("Error fetching user companies:", error);
      throw error;
    } finally {
      set({ companiesLoading: false });
    }
  },
  initialize: () => {
    // A session handed over by the app launcher wins over whatever this
    // origin has stored: the hub is where the user just signed in, so it is
    // the more recent truth. Reading it also strips it from the address bar.
    // Resolved before getSession so the stored session does not win a race.
    const handed = takeHandoffFromUrl();
    const ready = handed
      ? supabase.auth
          .setSession(handed)
          .catch(() => undefined)
          .then(() => undefined)
      : Promise.resolve(undefined);

    void ready.then(() =>
      supabase.auth
        .getSession()
        .then(async ({ data: { session } }) => {
        if (session?.user) {
          set({
            isAuthenticated: true,
            user: session.user,
          });

          try {
            await get().fetchUserCompanies();
          } catch {
            // Keep auth state even if company resolution fails.
          }
        }
        })
        .finally(() => {
          set({ sessionLoading: false });
        }),
    );

    supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        set({ isAuthenticated: true, user: session.user });
      } else {
        set({
          isAuthenticated: false,
          user: null,
          userRole: null,
          userCompanies: [],
        });
        localStorage.removeItem(ACTIVE_COMPANY_KEY);
      }
    });
  },
  setActiveCompany: (companyId: string) => {
    localStorage.setItem(ACTIVE_COMPANY_KEY, companyId);
    set({ activeCompanyId: companyId });
  },
  clearActiveCompany: () => {
    localStorage.removeItem(ACTIVE_COMPANY_KEY);
    set({ activeCompanyId: null });
  },
  isSuperAdmin: () => get().userRole === "super_admin",
}));

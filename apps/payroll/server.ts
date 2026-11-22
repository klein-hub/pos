/**
 * Payroll System - Admin API Server
 *
 * Handles super admin dashboard operations using Supabase service key
 * Runs on port 3000
 */

import express, { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ═══════════════════════════════════════════════════════════════
// SUPABASE CLIENT - Using Service Key for Admin Operations
// ═══════════════════════════════════════════════════════════════

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables",
  );
  process.exit(1);
}

// Create Supabase client with service key (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// ═══════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════

app.use(express.json());

// CORS middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  // Never "*": this server holds the service-role key, and a wildcard lets
  // any page on the internet call it from a visitor's browser.
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Vary", "Origin");
  }
  res.header("Access-Control-Allow-Credentials", "true");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization",
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Error handler
const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error: any) => {
      console.error("Handler error:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    });
  };

// ═══════════════════════════════════════════════════════════════
// COMPANIES ROUTES
// ═══════════════════════════════════════════════════════════════

/**
 * GET /admin/companies
 * List all companies
 */
app.get(
  "/admin/companies",
  asyncHandler(async (req: Request, res: Response) => {
    console.log("[API] GET /admin/companies");

    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[API] Error listing companies:", error);
      throw error;
    }

    console.log(`[API] Found ${data?.length || 0} companies`);
    res.json({ companies: data || [], count: data?.length || 0 });
  }),
);

/**
 * POST /admin/companies
 * Create new company
 */
app.post(
  "/admin/companies",
  asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Company name is required" });
    }

    console.log("[API] POST /admin/companies", { name });

    const { data, error } = await supabase
      .from("companies")
      .insert([{ name: name.trim() }])
      .select()
      .single();

    if (error) {
      console.error("[API] Error creating company:", error);
      throw error;
    }

    console.log("[API] Company created:", data);
    res.status(201).json(data);
  }),
);

/**
 * GET /admin/companies/:id
 * Get company details
 */
app.get(
  "/admin/companies/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    console.log("[API] GET /admin/companies/:id", { id });

    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .eq("id", id)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("[API] Error getting company:", error);
      throw error;
    }

    if (!data) {
      return res.status(404).json({ error: "Company not found" });
    }

    console.log("[API] Company found:", data);
    res.json(data);
  }),
);

/**
 * PUT /admin/companies/:id
 * Update company
 */
app.put(
  "/admin/companies/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name } = req.body;

    console.log("[API] PUT /admin/companies/:id", { id, name });

    const { data, error } = await supabase
      .from("companies")
      .update({ name: name.trim(), updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[API] Error updating company:", error);
      throw error;
    }

    console.log("[API] Company updated:", data);
    res.json(data);
  }),
);

/**
 * DELETE /admin/companies/:id
 * Delete company
 */
app.delete(
  "/admin/companies/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    console.log("[API] DELETE /admin/companies/:id", { id });

    const { error } = await supabase.from("companies").delete().eq("id", id);

    if (error) {
      console.error("[API] Error deleting company:", error);
      throw error;
    }

    console.log("[API] Company deleted:", id);
    res.status(204).send();
  }),
);

// ═══════════════════════════════════════════════════════════════
// STATISTICS ROUTES
// ═══════════════════════════════════════════════════════════════

/**
 * GET /admin/companies/:id/stats
 * Get company statistics
 */
app.get(
  "/admin/companies/:id/stats",
  asyncHandler(async (req: Request, res: Response) => {
    const { id: companyId } = req.params;
    console.log("[API] GET /admin/companies/:id/stats", { companyId });

    try {
      // Call the Supabase RPC function
      const { data, error } = await supabase.rpc("get_company_stats", {
        p_company_id: companyId,
      });

      if (error) {
        console.warn(
          "[API] RPC function error, calculating manually:",
          error.message,
        );
        // Fallback: Calculate stats manually
        const [employeeCount, attendanceCount, payrollCount] =
          await Promise.all([
            supabase
              .from("employees")
              .select("id", { count: "exact" })
              .eq("company_id", companyId),
            supabase
              .from("attendance")
              .select("id", { count: "exact" })
              .eq("company_id", companyId),
            supabase
              .from("payroll_records")
              .select("id", { count: "exact" })
              .eq("company_id", companyId),
          ]);

        const stats = {
          company_id: companyId,
          total_employees: employeeCount.count || 0,
          total_attendance_records: attendanceCount.count || 0,
          total_payroll_records: payrollCount.count || 0,
          average_salary: 0,
          total_payroll_amount: 0,
        };

        console.log("[API] Stats calculated:", stats);
        return res.json(stats);
      }

      console.log("[API] Stats retrieved:", data);
      res.json(data);
    } catch (error: any) {
      console.error("[API] Error getting stats:", error);
      throw error;
    }
  }),
);

/**
 * GET /admin/companies/:id/payroll
 * Get company payroll summary
 */
app.get(
  "/admin/companies/:id/payroll",
  asyncHandler(async (req: Request, res: Response) => {
    const { id: companyId } = req.params;
    console.log("[API] GET /admin/companies/:id/payroll", { companyId });

    const { data, error } = await supabase
      .from("payroll_records")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[API] Error getting payroll:", error);
      throw error;
    }

    const total =
      data?.reduce((sum, record: any) => sum + (record.net_amount || 0), 0) ||
      0;

    console.log(
      `[API] Found ${data?.length || 0} payroll records, total: ₱${total}`,
    );
    res.json({ records: data || [], total, count: data?.length || 0 });
  }),
);

/**
 * GET /admin/dashboard
 * Get dashboard overview
 */
app.get(
  "/admin/dashboard",
  asyncHandler(async (req: Request, res: Response) => {
    console.log("[API] GET /admin/dashboard");

    try {
      // Call RPC for dashboard overview
      const { data, error } = await supabase.rpc("get_dashboard_overview");

      if (error) {
        console.warn(
          "[API] RPC function error, calculating manually:",
          error.message,
        );
        // Fallback: Calculate manually
        const [companies, employees, payroll] = await Promise.all([
          supabase.from("companies").select("id", { count: "exact" }),
          supabase.from("employees").select("id", { count: "exact" }),
          supabase
            .from("payroll_records")
            .select("net_amount", { count: "exact" }),
        ]);

        const totalPayroll =
          payroll.data?.reduce(
            (sum: number, record: any) => sum + (record.net_amount || 0),
            0,
          ) || 0;

        const overview = {
          total_companies: companies.count || 0,
          total_employees: employees.count || 0,
          total_payroll_this_month: totalPayroll,
        };

        console.log("[API] Dashboard overview calculated:", overview);
        return res.json(overview);
      }

      console.log("[API] Dashboard overview retrieved:", data);
      res.json(data);
    } catch (error: any) {
      console.error("[API] Error getting dashboard:", error);
      throw error;
    }
  }),
);

// ═══════════════════════════════════════════════════════════════
// USER MANAGEMENT ROUTES
// ═══════════════════════════════════════════════════════════════

/**
 * Helper function to generate a random temporary password
 */

/**
 * Every /admin route requires a super admin.
 *
 * Applied as middleware rather than per handler: this server holds the
 * service-role key, which bypasses RLS entirely, so a route that forgets its
 * own check exposes every tenant's data. Eight of the nine routes here had no
 * check at all. Default-deny is the only arrangement that survives someone
 * adding a tenth in a hurry.
 */
async function requireSuperAdmin(req: any, res: any, next: any) {
  const check = await verifySuperAdminRequest(req);
  if (!check.ok) {
    return res.status(check.status).json({ error: check.error });
  }
  req.superAdmin = check.user;
  next();
}

app.use("/admin", (req: any, res: any, next: any) => {
  requireSuperAdmin(req, res, next).catch((error: any) => {
    console.error("auth middleware error:", error.message);
    res.status(500).json({ error: "Authorization check failed" });
  });
});

function generateTemporaryPassword(length: number = 12): string {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*";
  const all = uppercase + lowercase + numbers + symbols;

  let password = "";
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  for (let i = password.length; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

const SUPER_ADMIN_EMAILS = ["kleinhans.esc@gmail.com"];

async function verifySuperAdminRequest(req: Request): Promise<{
  ok: boolean;
  status: number;
  error?: string;
}> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Missing bearer token" };
  }

  const accessToken = authHeader.substring("Bearer ".length).trim();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    return { ok: false, status: 401, error: "Invalid or expired token" };
  }

  const role = user.app_metadata?.role ?? user.user_metadata?.role;
  const isSuperAdmin =
    role === "super_admin" || SUPER_ADMIN_EMAILS.includes(user.email || "");

  if (!isSuperAdmin) {
    return { ok: false, status: 403, error: "Super admin access required" };
  }

  return { ok: true, status: 200 };
}

/**
 * POST /admin/employees/create-account
 * Create a user account for an employee
 * Request body:
 *   - employee_id: uuid - The employee ID
 *   - account_email: string - Email for the account
 *   - password?: string - Optional password; generated if omitted
 *   - is_temporary_password?: boolean - Flag to require password reset on first login
 *   - first_name: string - Employee first name
 *   - last_name: string - Employee last name
 *   - company_id: uuid - Company the employee belongs to
 */
app.post(
  "/admin/employees/create-account",
  asyncHandler(async (req: Request, res: Response) => {
    const authCheck = await verifySuperAdminRequest(req);
    if (!authCheck.ok) {
      return res
        .status(authCheck.status)
        .json({ error: authCheck.error || "Unauthorized" });
    }

    const {
      employee_id,
      account_email,
      password,
      is_temporary_password,
      first_name,
      last_name,
      company_id,
    } = req.body;

    if (!employee_id || !account_email) {
      return res
        .status(400)
        .json({ error: "employee_id and account_email are required" });
    }

    console.log("[API] POST /admin/employees/create-account", {
      employee_id,
      account_email,
    });

    try {
      const providedPassword = typeof password === "string" ? password : "";
      const temporaryPassword = providedPassword || generateTemporaryPassword();
      const isGeneratedPassword = !providedPassword;
      const requiresPasswordChange =
        isGeneratedPassword || Boolean(is_temporary_password);

      // Create user in auth.users
      const { data: authData, error: authError } =
        await supabase.auth.admin.createUser({
          email: account_email,
          password: temporaryPassword,
          email_confirm: true,
          user_metadata: {
            first_name: first_name || "",
            last_name: last_name || "",
            company_id: company_id || null,
            role: "employee",
            temporary_password: requiresPasswordChange,
            requires_password_change: requiresPasswordChange,
          },
        });

      if (authError || !authData?.user) {
        console.error("[API] Error creating auth user:", authError);
        return res.status(400).json({
          error: authError?.message || "Failed to create auth user",
        });
      }

      const userId = authData.user.id;

      // Create profile record
      const { error: profileError } = await supabase.from("profiles").insert([
        {
          id: userId,
          company_id: company_id || null,
          first_name: first_name || null,
          last_name: last_name || null,
          avatar_url: null,
          role_id: null,
          is_deleted: false,
          role: "employee",
        },
      ]);

      if (profileError) {
        console.error("[API] Error creating profile:", profileError);
        // Try to delete the auth user since profile creation failed
        await supabase.auth.admin.deleteUser(userId);
        return res
          .status(400)
          .json({ error: profileError.message || "Failed to create profile" });
      }

      console.log("[API] User account created:", { userId, account_email });

      // Return the temporary password and user info
      res.status(201).json({
        user: {
          id: userId,
          email: account_email,
          first_name,
          last_name,
        },
        temporaryPassword: isGeneratedPassword ? temporaryPassword : null,
        message: isGeneratedPassword
          ? "User account created successfully. Share the temporary password with the employee."
          : "User account created successfully.",
      });
    } catch (error: any) {
      console.error("[API] Error in create-account:", error);
      throw error;
    }
  }),
);

/**
 * Health check endpoint
 */
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ═══════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log(`🚀 Admin API Server running on http://localhost:${PORT}`);
  console.log(`📚 Supabase URL: ${supabaseUrl}`);
  console.log(`🔐 Using Service Key for admin operations`);
});

export default app;

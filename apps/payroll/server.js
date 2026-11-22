/**
 * Payroll System - Admin API Server
 *
 * Handles super admin dashboard operations using Supabase service key
 * Runs on port 3000
 */

import express from "express";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { randomBytes } from "crypto";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ═══════════════════════════════════════════════════════════════
// SUPABASE CLIENT - Using Service Key for Admin Operations
// This route needs the service role so it can create auth.users records.
// ═══════════════════════════════════════════════════════════════

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables",
  );
  console.error("   VITE_SUPABASE_URL:", supabaseUrl ? "✓" : "✗");
  console.error("   SUPABASE_SERVICE_KEY:", supabaseServiceKey ? "✓" : "✗");
  process.exit(1);
}

// Create Supabase client with service key (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

console.log("🔐 Supabase client initialized with service key");
console.log("📍 Supabase URL:", supabaseUrl);
console.log("📋 Note: Using service role for admin account creation");

// ═══════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════

app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
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
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    console.error("❌ Handler error:", error.message);
    res.status(500).json({ error: error.message || "Internal server error" });
  });
};

const SUPER_ADMIN_EMAILS = ["kleinhans.esc@gmail.com"];

async function verifySuperAdminRequest(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Missing authorization token" };
  }

  const accessToken = authHeader.slice(7);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    return { ok: false, status: 401, error: "Invalid session" };
  }

  const role = user.user_metadata?.role || user.app_metadata?.role;
  const isSuperAdmin =
    role === "super_admin" || SUPER_ADMIN_EMAILS.includes(user.email || "");

  if (!isSuperAdmin) {
    return { ok: false, status: 403, error: "Super admin access required" };
  }

  return { ok: true, user };
}


/**
 * Every /admin route requires a super admin.
 *
 * Applied as middleware rather than per handler: this server holds the
 * service-role key, which bypasses RLS entirely, so a route that forgets its
 * own check exposes every tenant's data. Eight of the nine routes here had no
 * check at all. Default-deny is the only arrangement that survives someone
 * adding a tenth in a hurry.
 */
async function requireSuperAdmin(req, res, next) {
  const check = await verifySuperAdminRequest(req);
  if (!check.ok) {
    return res.status(check.status).json({ error: check.error });
  }
  req.superAdmin = check.user;
  next();
}

app.use("/admin", (req, res, next) => {
  requireSuperAdmin(req, res, next).catch((error) => {
    console.error("auth middleware error:", error.message);
    res.status(500).json({ error: "Authorization check failed" });
  });
});

function generateTemporaryPassword(length = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(length);
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}

// ═══════════════════════════════════════════════════════════════
// COMPANIES ROUTES
// ═══════════════════════════════════════════════════════════════

/**
 * GET /admin/companies
 * List all companies
 */
app.get(
  "/admin/companies",
  asyncHandler(async (req, res) => {
    console.log("[API] GET /admin/companies");

    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[API] Error listing companies:", error);
      throw error;
    }

    console.log(`[API] ✓ Found ${data?.length || 0} companies`);
    res.json({ companies: data || [], count: data?.length || 0 });
  }),
);

/**
 * POST /admin/companies
 * Create new company
 */
app.post(
  "/admin/companies",
  asyncHandler(async (req, res) => {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Company name is required" });
    }

    console.log("[API] POST /admin/companies", { name: name.trim() });

    const { data, error } = await supabase
      .from("companies")
      .insert([
        {
          name: name.trim(),
          brand: name.trim(), // Use company name as brand
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("[API] ✗ Error creating company:", error);
      throw error;
    }

    console.log("[API] ✓ Company created:", data.id, data.name);
    res.status(201).json(data);
  }),
);

/**
 * GET /admin/companies/:id
 * Get company details
 */
app.get(
  "/admin/companies/:id",
  asyncHandler(async (req, res) => {
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

    console.log("[API] ✓ Company found:", data.name);
    res.json(data);
  }),
);

/**
 * PUT /admin/companies/:id
 * Update company
 */
app.put(
  "/admin/companies/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;

    console.log("[API] PUT /admin/companies/:id", { id, name: name?.trim() });

    const { data, error } = await supabase
      .from("companies")
      .update({
        name: name.trim(),
        brand: name.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[API] Error updating company:", error);
      throw error;
    }

    console.log("[API] ✓ Company updated:", data.name);
    res.json(data);
  }),
);

/**
 * DELETE /admin/companies/:id
 * Delete company
 */
app.delete(
  "/admin/companies/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    console.log("[API] DELETE /admin/companies/:id", { id });

    const { error } = await supabase.from("companies").delete().eq("id", id);

    if (error) {
      console.error("[API] Error deleting company:", error);
      throw error;
    }

    console.log("[API] ✓ Company deleted:", id);
    res.status(204).send();
  }),
);

// ═══════════════════════════════════════════════════════════════
// EMPLOYEE ACCOUNT ROUTES
// ═══════════════════════════════════════════════════════════════

/**
 * POST /admin/employees/create-account
 * Create a user account for an employee
 */
app.post(
  "/admin/employees/create-account",
  asyncHandler(async (req, res) => {
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

    const providedPassword = typeof password === "string" ? password : "";
    const temporaryPassword = providedPassword || generateTemporaryPassword();
    const isGeneratedPassword = !providedPassword;
    const requiresPasswordChange =
      isGeneratedPassword || Boolean(is_temporary_password);

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
      await supabase.auth.admin.deleteUser(userId);
      return res.status(400).json({
        error: profileError.message || "Failed to create profile",
      });
    }

    console.log("[API] User account created:", { userId, account_email });

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
  asyncHandler(async (req, res) => {
    const { id: companyId } = req.params;
    console.log("[API] GET /admin/companies/:id/stats", { companyId });

    try {
      // Call the Supabase RPC function
      const { data, error } = await supabase.rpc("get_company_stats", {
        p_company_id: companyId,
      });

      if (error) {
        console.warn(
          "[API] RPC function unavailable, calculating manually:",
          error.message,
        );
        // Fallback: Calculate stats manually
        const [employeeRes, attendanceRes, payrollRes] = await Promise.all([
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
          total_employees: employeeRes.count || 0,
          total_attendance_records: attendanceRes.count || 0,
          total_payroll_records: payrollRes.count || 0,
          average_salary: 0,
          total_payroll_amount: 0,
        };

        console.log("[API] ✓ Stats calculated:", stats);
        return res.json(stats);
      }

      console.log("[API] ✓ Stats retrieved from RPC");
      res.json(data);
    } catch (error) {
      console.error("[API] Error getting stats:", error?.message);
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
  asyncHandler(async (req, res) => {
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
      data?.reduce((sum, record) => sum + (record.net_amount || 0), 0) || 0;

    console.log(`[API] ✓ Found ${data?.length || 0} payroll records`);
    res.json({ records: data || [], total, count: data?.length || 0 });
  }),
);

/**
 * GET /admin/dashboard
 * Get dashboard overview
 */
app.get(
  "/admin/dashboard",
  asyncHandler(async (req, res) => {
    console.log("[API] GET /admin/dashboard");

    try {
      // Call RPC for dashboard overview
      const { data, error } = await supabase.rpc("get_dashboard_overview");

      if (error) {
        console.warn(
          "[API] RPC function unavailable, calculating manually:",
          error.message,
        );
        // Fallback: Calculate manually
        const [companiesRes, employeesRes, payrollRes] = await Promise.all([
          supabase.from("companies").select("id", { count: "exact" }),
          supabase.from("employees").select("id", { count: "exact" }),
          supabase
            .from("payroll_records")
            .select("net_amount", { count: "exact" }),
        ]);

        const totalPayroll =
          payrollRes.data?.reduce(
            (sum, record) => sum + (record.net_amount || 0),
            0,
          ) || 0;

        const overview = {
          total_companies: companiesRes.count || 0,
          total_employees: employeesRes.count || 0,
          total_payroll_this_month: totalPayroll,
        };

        console.log("[API] ✓ Dashboard overview calculated");
        return res.json(overview);
      }

      console.log("[API] ✓ Dashboard overview retrieved from RPC");
      res.json(data);
    } catch (error) {
      console.error("[API] Error getting dashboard:", error?.message);
      throw error;
    }
  }),
);

/**
 * Health check endpoint
 */
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ═══════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log(`\n🚀 Admin API Server running on http://localhost:${PORT}`);
  console.log(`📚 Supabase URL: ${supabaseUrl}`);
  console.log(`🔐 Using Service Key for admin operations`);
  console.log(`💪 Ready to handle admin API requests\n`);
});

export default app;

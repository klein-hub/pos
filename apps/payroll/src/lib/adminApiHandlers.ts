/**
 * Admin API Handlers
 *
 * Request/response handlers for super admin dashboard endpoints
 * Can be used with Express, Fastify, or Supabase Edge Functions
 *
 * Example usage with Express:
 * ```typescript
 * import { adminRouter } from '@/lib/adminApiHandlers';
 * app.use('/api/admin', adminRouter);
 * ```
 */

import {
  listCompanies,
  getCompany,
  createCompany,
  getCompanyStats,
  getAllCompaniesStats,
  getCompanyPayrollSummary,
  getDashboardOverview,
} from "./adminService";

// ═══════════════════════════════════════════════════════════════
// Type Definitions
// ═══════════════════════════════════════════════════════════════

export interface ApiRequest {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  params?: Record<string, string>;
  body?: Record<string, any>;
  user?: { id: string; role: string };
}

export interface ApiResponse<T = any> {
  status: number;
  body: T | { error: string };
}

// ═══════════════════════════════════════════════════════════════
// Middleware & Utilities
// ═══════════════════════════════════════════════════════════════

/**
 * Check if user is super admin
 */
function isSuperAdmin(user: any): boolean {
  return user && user.role === "super_admin";
}

/**
 * Generate error response
 */
function errorResponse<T = any>(
  status: number,
  message: string,
): ApiResponse<T> {
  return {
    status,
    body: { error: message } as any,
  };
}

/**
 * Generate success response
 */
function successResponse<T>(body: T, status: number = 200): ApiResponse<T> {
  return { status, body };
}

// ═══════════════════════════════════════════════════════════════
// COMPANIES ROUTES
// ═══════════════════════════════════════════════════════════════

/**
 * GET /admin/companies
 * List all companies
 */
export async function handleGetCompanies(
  req: ApiRequest,
): Promise<ApiResponse> {
  try {
    if (!isSuperAdmin(req.user)) {
      return errorResponse(403, "Unauthorized: Super admin access required");
    }

    const companies = await listCompanies();
    return successResponse({ companies, count: companies.length });
  } catch (error: any) {
    return errorResponse(500, `Failed to list companies: ${error.message}`);
  }
}

/**
 * GET /admin/companies/:id
 * Get company details
 */
export async function handleGetCompany(req: ApiRequest): Promise<ApiResponse> {
  try {
    if (!isSuperAdmin(req.user)) {
      return errorResponse(403, "Unauthorized: Super admin access required");
    }

    const companyId = req.params?.id;
    if (!companyId) {
      return errorResponse(400, "Missing company ID");
    }

    const company = await getCompany(companyId);
    if (!company) {
      return errorResponse(404, "Company not found");
    }

    const stats = await getCompanyStats(companyId);
    return successResponse({ company, stats });
  } catch (error: any) {
    return errorResponse(500, `Failed to get company: ${error.message}`);
  }
}

/**
 * POST /admin/companies
 * Create new company
 */
export async function handleCreateCompany(
  req: ApiRequest,
): Promise<ApiResponse> {
  try {
    if (!isSuperAdmin(req.user)) {
      return errorResponse(403, "Unauthorized: Super admin access required");
    }

    const { name } = req.body || {};
    if (!name || typeof name !== "string") {
      return errorResponse(400, "Invalid request: name is required");
    }

    const company = await createCompany(name);
    return successResponse({ company }, 201);
  } catch (error: any) {
    return errorResponse(500, `Failed to create company: ${error.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// COMPANY STATS ROUTES
// ═══════════════════════════════════════════════════════════════

/**
 * GET /admin/companies/:id/stats
 * Get company statistics
 */
export async function handleGetCompanyStats(
  req: ApiRequest,
): Promise<ApiResponse> {
  try {
    if (!isSuperAdmin(req.user)) {
      return errorResponse(403, "Unauthorized: Super admin access required");
    }

    const companyId = req.params?.id;
    if (!companyId) {
      return errorResponse(400, "Missing company ID");
    }

    const stats = await getCompanyStats(companyId);
    if (!stats) {
      return errorResponse(404, "Company not found");
    }

    return successResponse({ stats });
  } catch (error: any) {
    return errorResponse(500, `Failed to get company stats: ${error.message}`);
  }
}

/**
 * GET /admin/companies/:id/payroll?month=5&year=2026
 * Get payroll summary for month
 */
export async function handleGetCompanyPayrollSummary(
  req: ApiRequest,
): Promise<ApiResponse> {
  try {
    if (!isSuperAdmin(req.user)) {
      return errorResponse(403, "Unauthorized: Super admin access required");
    }

    const companyId = req.params?.id;
    if (!companyId) {
      return errorResponse(400, "Missing company ID");
    }

    const month = parseInt(
      req.params?.month || new Date().getMonth() + 1 + "",
      10,
    );
    const year = parseInt(
      req.params?.year || new Date().getFullYear() + "",
      10,
    );

    if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
      return errorResponse(400, "Invalid month or year");
    }

    const summary = await getCompanyPayrollSummary(companyId, month, year);
    return successResponse({ summary });
  } catch (error: any) {
    return errorResponse(
      500,
      `Failed to get payroll summary: ${error.message}`,
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD ROUTES
// ═══════════════════════════════════════════════════════════════

/**
 * GET /admin/dashboard
 * Get dashboard overview
 */
export async function handleGetDashboardOverview(
  req: ApiRequest,
): Promise<ApiResponse> {
  try {
    if (!isSuperAdmin(req.user)) {
      return errorResponse(403, "Unauthorized: Super admin access required");
    }

    const overview = await getDashboardOverview();
    return successResponse({ overview });
  } catch (error: any) {
    return errorResponse(
      500,
      `Failed to get dashboard overview: ${error.message}`,
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// ROUTER EXAMPLE (for Express)
// ═══════════════════════════════════════════════════════════════

/**
 * Example Express router setup
 * Usage: app.use('/api/admin', adminRouter);
 */
export function createAdminRouter(express: any) {
  const router = express.Router();

  // Companies
  router.get("/companies", async (req: any, res: any) => {
    const apiReq: ApiRequest = {
      method: "GET",
      path: req.path,
      user: req.user,
    };
    const apiRes = await handleGetCompanies(apiReq);
    res.status(apiRes.status).json(apiRes.body);
  });

  router.get("/companies/:id", async (req: any, res: any) => {
    const apiReq: ApiRequest = {
      method: "GET",
      path: req.path,
      params: req.params,
      user: req.user,
    };
    const apiRes = await handleGetCompany(apiReq);
    res.status(apiRes.status).json(apiRes.body);
  });

  router.post("/companies", async (req: any, res: any) => {
    const apiReq: ApiRequest = {
      method: "POST",
      path: req.path,
      body: req.body,
      user: req.user,
    };
    const apiRes = await handleCreateCompany(apiReq);
    res.status(apiRes.status).json(apiRes.body);
  });

  // Stats
  router.get("/companies/:id/stats", async (req: any, res: any) => {
    const apiReq: ApiRequest = {
      method: "GET",
      path: req.path,
      params: req.params,
      user: req.user,
    };
    const apiRes = await handleGetCompanyStats(apiReq);
    res.status(apiRes.status).json(apiRes.body);
  });

  router.get("/companies/:id/payroll", async (req: any, res: any) => {
    const apiReq: ApiRequest = {
      method: "GET",
      path: req.path,
      params: { id: req.params.id, ...req.query },
      user: req.user,
    };
    const apiRes = await handleGetCompanyPayrollSummary(apiReq);
    res.status(apiRes.status).json(apiRes.body);
  });

  // Dashboard
  router.get("/dashboard", async (req: any, res: any) => {
    const apiReq: ApiRequest = {
      method: "GET",
      path: req.path,
      user: req.user,
    };
    const apiRes = await handleGetDashboardOverview(apiReq);
    res.status(apiRes.status).json(apiRes.body);
  });

  return router;
}

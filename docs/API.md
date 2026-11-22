# Payroll System - API Documentation

## Overview

The Payroll System API is divided into two parts:
1. **Public API** (Frontend, http://localhost:5173) - Uses Supabase client
2. **Admin API** (Backend, http://localhost:3000) - Express.js server

## Authentication

All API requests require a valid Supabase JWT token in the `Authorization` header:

```
Authorization: Bearer <your-jwt-token>
```

Tokens are obtained via Supabase Auth and automatically included in frontend requests.

## Admin API (http://localhost:3000)

### Companies Endpoints

#### GET /admin/companies

List all companies (super admin only).

**Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/admin/companies
```

**Response:**
```json
{
  "companies": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "Pristine Energy",
      "created_at": "2026-05-01T00:00:00Z",
      "updated_at": "2026-05-01T00:00:00Z"
    }
  ],
  "count": 1
}
```

---

#### POST /admin/companies

Create a new company (super admin only).

**Request:**
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "New Company"}' \
  http://localhost:3000/admin/companies
```

**Request Body:**
```json
{
  "name": "string (required, 1-255 chars)"
}
```

**Response:**
```json
{
  "company": {
    "id": "uuid",
    "name": "New Company",
    "created_at": "2026-05-03T10:30:00Z",
    "updated_at": "2026-05-03T10:30:00Z"
  }
}
```

**Status Codes:**
- `201 Created` - Company created successfully
- `400 Bad Request` - Invalid input (missing name, etc.)
- `403 Forbidden` - Only super admin can create companies

---

#### GET /admin/companies/:id/stats

Get statistics for a company (admin or above).

**Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/admin/companies/123e4567-e89b-12d3-a456-426614174000/stats
```

**Response:**
```json
{
  "stats": {
    "total_employees": 5,
    "total_attendance_records": 45,
    "total_payroll_amount": 450000,
    "average_salary": 90000,
    "attendance_rate": 92.5
  }
}
```

---

#### GET /admin/companies/:id/payroll

Get payroll summary for a company (admin or above).

**Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/admin/companies/:id/payroll?month=5&year=2026"
```

**Query Parameters:**
- `month` (optional): 1-12
- `year` (optional): YYYY format

**Response:**
```json
{
  "payroll": {
    "company_id": "uuid",
    "month": 5,
    "year": 2026,
    "total_amount": 450000,
    "total_employees": 5,
    "generated_at": "2026-05-03T10:30:00Z"
  }
}
```

---

### Company Users Endpoints

#### GET /admin/companies/:id/users

List users assigned to a company.

**Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/admin/companies/123e4567-e89b-12d3-a456-426614174000/users
```

**Response:**
```json
{
  "users": [
    {
      "user_id": "auth-user-id-1",
      "role": "admin",
      "email": "admin@company.test",
      "created_at": "2026-05-01T00:00:00Z"
    },
    {
      "user_id": "auth-user-id-2",
      "role": "employee",
      "email": "emp@company.test",
      "created_at": "2026-05-02T00:00:00Z"
    }
  ]
}
```

---

#### POST /admin/companies/:id/users

Assign a user to a company with a role.

**Request:**
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_email": "newuser@company.test",
    "role": "employee"
  }' \
  http://localhost:3000/admin/companies/:id/users
```

**Request Body:**
```json
{
  "user_email": "string (required, valid email)",
  "role": "admin | employee (required)"
}
```

**Response:**
```json
{
  "company_user": {
    "user_id": "uuid",
    "company_id": "uuid",
    "role": "employee",
    "created_at": "2026-05-03T10:30:00Z"
  }
}
```

**Status Codes:**
- `201 Created` - User assigned successfully
- `400 Bad Request` - Invalid email or role
- `409 Conflict` - User already assigned to this company

---

#### PUT /admin/companies/:id/users/:userId

Update user role in a company.

**Request:**
```bash
curl -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}' \
  http://localhost:3000/admin/companies/:id/users/:userId
```

**Request Body:**
```json
{
  "role": "admin | employee (required)"
}
```

**Response:**
```json
{
  "company_user": {
    "user_id": "uuid",
    "company_id": "uuid",
    "role": "admin",
    "updated_at": "2026-05-03T10:30:00Z"
  }
}
```

---

#### DELETE /admin/companies/:id/users/:userId

Remove a user from a company.

**Request:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/admin/companies/:id/users/:userId
```

**Response:**
```json
{
  "success": true,
  "message": "User removed from company"
}
```

---

### Dashboard Endpoint

#### GET /admin/dashboard

Get overview statistics for all companies (super admin only).

**Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/admin/dashboard
```

**Response:**
```json
{
  "dashboard": {
    "total_companies": 2,
    "total_employees": 15,
    "total_payroll_amount": 1500000,
    "average_company_size": 7.5,
    "companies": [
      {
        "id": "uuid",
        "name": "Company A",
        "employee_count": 8,
        "payroll_total": 800000
      },
      {
        "id": "uuid",
        "name": "Company B",
        "employee_count": 7,
        "payroll_total": 700000
      }
    ]
  }
}
```

---

## Supabase Data API

These endpoints are accessed via the Supabase JavaScript client from the frontend.

### Authentication

#### Sign Up
```typescript
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password123',
});
```

#### Sign In
```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123',
});
```

#### Sign Out
```typescript
const { error } = await supabase.auth.signOut();
```

---

### Companies Table

All queries on companies table are protected by RLS. Users can only see companies they're assigned to.

#### Select companies
```typescript
const { data, error } = await supabase
  .from('companies')
  .select('*');
```

---

### Employees Table

Protected by RLS. Users can only see employees in their assigned companies.

#### Select employees
```typescript
const { data, error } = await supabase
  .from('employee')
  .select('*')
  .eq('company_id', companyId);
```

#### Insert employee
```typescript
const { data, error } = await supabase
  .from('employee')
  .insert({
    company_id: companyId,
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@company.test',
    position: 'Manager',
    base_salary: 100000,
  });
```

#### Update employee
```typescript
const { data, error } = await supabase
  .from('employee')
  .update({ base_salary: 110000 })
  .eq('id', employeeId)
  .eq('company_id', companyId);
```

#### Delete employee
```typescript
const { data, error } = await supabase
  .from('employee')
  .delete()
  .eq('id', employeeId)
  .eq('company_id', companyId);
```

---

### Attendance Table

Protected by RLS. Users can only see attendance records for their company.

#### Select attendance
```typescript
const { data, error } = await supabase
  .from('attendance')
  .select('*')
  .eq('company_id', companyId)
  .gte('date', startDate)
  .lte('date', endDate);
```

#### Insert attendance
```typescript
const { data, error } = await supabase
  .from('attendance')
  .insert({
    company_id: companyId,
    employee_id: employeeId,
    date: '2026-05-03',
    status: 'present', // 'present', 'absent', 'late'
  });
```

---

### Payroll Records Table

Protected by RLS. Users can only see payroll records for their company.

#### Select payroll records
```typescript
const { data, error } = await supabase
  .from('payroll_records')
  .select('*')
  .eq('company_id', companyId)
  .eq('month', 5)
  .eq('year', 2026);
```

#### Insert payroll record
```typescript
const { data, error } = await supabase
  .from('payroll_records')
  .insert({
    company_id: companyId,
    employee_id: employeeId,
    month: 5,
    year: 2026,
    base_salary: 100000,
    gross_salary: 90000,
    deductions: 10000,
    net_salary: 80000,
    status: 'generated',
  });
```

---

## PostgreSQL Functions

### calculate_attendance()

Calculate attendance summary for an employee.

```sql
SELECT * FROM calculate_attendance(
  employee_id => 'uuid',
  company_id => 'uuid',
  start_date => '2026-05-01',
  end_date => '2026-05-31'
);
```

**Returns:**
- `present_days` (int)
- `absent_days` (int)
- `late_count` (int)
- `total_work_days` (int)
- `attendance_percentage` (numeric)

---

### generate_payroll()

Generate a payroll record for an employee.

```sql
SELECT * FROM generate_payroll(
  employee_id => 'uuid',
  company_id => 'uuid',
  month => 5,
  year => 2026
);
```

**Returns:**
- `payroll_id` (uuid)
- `employee_id` (uuid)
- `month` (int)
- `year` (int)
- `gross_salary` (numeric)
- `net_salary` (numeric)
- `status` (text)

---

### generate_payslip()

Generate a formatted payslip HTML/text.

```sql
SELECT * FROM generate_payslip(
  payroll_id => 'uuid',
  company_id => 'uuid'
);
```

**Returns:**
- HTML formatted payslip with employee details, salary breakdown, and net amount

---

## Error Handling

### Common Error Codes

- `400 Bad Request` - Invalid input parameters
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - Insufficient permissions or company isolation violation
- `404 Not Found` - Resource doesn't exist
- `409 Conflict` - Duplicate entry or constraint violation
- `500 Internal Server Error` - Server error

### Error Response Format

```json
{
  "error": {
    "code": "PGRST116",
    "message": "RLS policy violation",
    "details": "row level security policy..."
  }
}
```

---

## Rate Limiting

- **Admin API**: 100 requests per minute per IP
- **Supabase**: Standard tier limits apply (see Supabase docs)

---

## Testing API Endpoints

### Using cURL

```bash
# Get all companies
TOKEN="your-jwt-token-here"
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/admin/companies

# Create a company
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Company"}' \
  http://localhost:3000/admin/companies
```

### Using Postman

1. Create a new request in Postman
2. Set method to GET/POST/etc.
3. Add header: `Authorization: Bearer <token>`
4. Paste endpoint URL
5. Add JSON body for POST/PUT requests
6. Click Send

### Using Supabase Studio

1. Go to your Supabase project → SQL Editor
2. Run queries directly on tables
3. Check RLS policies are working

---

## Versioning

Current API Version: **v1** (implicit)

Future versions will be prefixed: `/api/v2/...`

---

**Last Updated**: May 3, 2026  
**Status**: Complete for Phases 1-9

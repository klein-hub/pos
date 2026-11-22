# Payroll System - Multi-tenant Attendance & Payroll Management

A comprehensive multi-tenant payroll and attendance tracking system built with React, TypeScript, Node.js, and Supabase. Designed for companies to manage employees, track attendance, generate payslips, and manage payroll with complete company isolation via Row-Level Security (RLS).

## Features

- **Multi-tenant Architecture**: Complete company isolation using Supabase RLS policies
- **Super Admin Dashboard**: Manage multiple companies and users
- **Company Admin Dashboard**: Manage employees, attendance, and payroll for your company
- **Employee Dashboard**: View attendance records and payslips
- **Company Selector**: Switch between companies without re-authenticating
- **Attendance Tracking**: Track employee attendance with present/absent/late status
- **Payroll Generation**: Automatic payroll calculation based on attendance
- **Payslip Generation**: Generate and download payslips with breakdown details
- **Authentication**: Supabase Auth with role-based access control

## Project Structure

```
payroll/
├── src/
│   ├── components/     # Reusable UI components
│   │   └── layout/     # Layout components (Sidebar, Header)
│   ├── contexts/       # React contexts (SidebarContext)
│   ├── hooks/          # Custom hooks (useCompanyContext, useCompanyQuery)
│   ├── layouts/        # Page layouts (AdminLayout, AuthLayout)
│   ├── lib/            # Libraries (supabase client)
│   ├── pages/          # Page components (Dashboard, Payroll, etc.)
│   ├── store/          # Zustand stores (authStore)
│   ├── utils/          # Utility functions (testDataSeeder)
│   ├── App.tsx         # Main app component with routing
│   ├── main.tsx        # React entry point
│   └── theme.ts        # Chakra UI theme
├── server.js           # Express API server for admin operations
├── .env                # Environment variables
└── DEVELOPMENT_ROADMAP.md  # Detailed development tracking
```

## Tech Stack

### Frontend

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Fast build tool
- **Chakra UI** - Component library
- **React Router** - Client routing
- **Zustand** - State management
- **Supabase JS Client** - Database & auth
- **React Hot Toast** - Notifications

### Backend

- **Node.js** - Runtime
- **Express** - API framework
- **Supabase** - PostgreSQL database + RLS + Auth
- **PostgreSQL** - Database engine

### Infrastructure

- **Supabase** - Managed PostgreSQL, Auth, and RLS
- **Vite** - Development and production builds
- **Docker** - Containerization (optional)

## Setup Instructions

### Prerequisites

- Node.js 16+ and npm
- Supabase account (free at supabase.com)
- Git

### 1. Clone the Repository

```bash
git clone <repo-url>
cd payroll
npm install
```

### 2. Set Up Supabase

1. Create a new Supabase project
2. Note your **Project URL** and **Anon Key**
3. Create the database schema (see Database Setup section below)

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
VITE_API_URL=http://localhost:3000
SUPABASE_SERVICE_KEY=your-service-key-here
```

Get these values from your Supabase project settings.

### 4. Database Setup

Run the SQL migrations in `docs/supabase-schema.sql` in your Supabase SQL editor:

```sql
-- Companies table
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- RLS on companies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- ... (see full schema in docs/supabase-schema.sql)
```

### 5. Start Development Servers

```bash
# Start both API server and frontend dev server
npm run dev:all

# Or separately:
npm run dev:server  # API on http://localhost:3000
npm run dev:client  # Frontend on http://localhost:5173
```

## Testing

### Test Users

The system includes predefined test users for Pristine Energy company:

| Email                           | Password       | Role        | Purpose                       |
| ------------------------------- | -------------- | ----------- | ----------------------------- |
| super_admin@pristineenergy.test | SuperAdmin123! | super_admin | Manage all companies          |
| admin@pristineenergy.test       | Admin123!      | admin       | Manage company & employees    |
| manager@pristineenergy.test     | Manager123!    | admin       | Generate payroll reports      |
| employee1@pristineenergy.test   | Employee123!   | employee    | View own payslip & attendance |
| employee2@pristineenergy.test   | Employee123!   | employee    | View own payslip & attendance |

**Note**: Users must be created in Supabase Auth before logging in.

### Running Tests

1. Navigate to `/test` in the app (visible in sidebar after login)
2. Run the following test suites:
   - **Setup Validation**: Verify Pristine Energy company is configured
   - **Company Isolation**: Test RLS policies prevent data leakage
   - **Integration Tests**: End-to-end workflow tests (coming soon)

### Manual Testing

1. **Login Flow**:
   - Go to http://localhost:5173/login
   - Enter super_admin@pristineenergy.test / SuperAdmin123!
   - Should redirect to company selector
   - Select Pristine Energy company
   - Should redirect to dashboard

2. **Company Selector**:
   - Logout and login with a user assigned to multiple companies
   - Should show company selector page
   - Choose a company to proceed

3. **Company Isolation**:
   - Login as admin from Company A
   - Try to access Company B's employees (should fail with RLS error)
   - Verify in browser console that 403 errors are returned

## API Endpoints

### Admin API (http://localhost:3000)

#### Companies

- `GET /admin/companies` - List all companies (super admin only)
- `POST /admin/companies` - Create new company
- `GET /admin/companies/:id/stats` - Get company statistics
- `GET /admin/companies/:id/users` - List users for company
- `POST /admin/companies/:id/users` - Assign user to company
- `PUT /admin/companies/:id/users/:userId` - Update user role
- `DELETE /admin/companies/:id/users/:userId` - Remove user from company

#### With Company Context

All other endpoints must include `?company_id={companyId}`:

- `GET /employees?company_id=...` - List employees
- `POST /employees?company_id=...` - Create employee
- `GET /attendance?company_id=...` - List attendance
- `GET /payroll?company_id=...` - List payroll records
- `POST /payroll/generate?company_id=...` - Generate payroll

## Architecture Details

### Multi-tenant Isolation

Company isolation is enforced at multiple layers:

1. **Database Layer (RLS)**:

   ```sql
   CREATE POLICY "Employees are visible to their company"
   ON employee FOR SELECT
   ```

2. **API Layer**:
   - All data-fetching endpoints require `?company_id=...` parameter
   - Server-side verification of company membership via JWT

3. **Frontend Layer**:
   - `useCompanyContext()` hook enforces active company selection
   - `useCompanyQuery()` hook automatically appends `company_id` to all requests
   - Company selector prevents users from skipping company selection

### Authentication Flow

```
Login
  ↓
Supabase Auth (email + password)
  ↓
Fetch user's assigned companies
  ↓
Company Selector (if multiple companies)
  ↓
Auto-select (if only one company)
  ↓
Dashboard with active company
```

### Payroll Calculation

Formula: `(base_salary / 22) × present_days`

- Base salary from employee record
- Present days from attendance records
- 22 working days per month (configurable)
- Deductions and bonuses calculated separately (Phase 10)

## Development Roadmap

See `DEVELOPMENT_ROADMAP.md` for detailed tracking of:

- **Phases 1-7**: ✅ Complete (Schema, RLS, API, Auth)
- **Phase 8**: Testing & Validation
- **Phase 9**: Documentation
- **Phase 10**: Advanced Features (approval workflow, batch generation, PDF exports)
- **Phase 11**: Analytics & Reporting
- **Phase 12**: Mobile & Real-time Notifications
- **Phases A1-A12**: Attendance Tracker (schema extensions, mobile, geofencing)

## Common Tasks

### Create a Test User

1. Go to Supabase dashboard → Authentication → Users
2. Create new user with:
   - Email: `newemail@company.test`
   - Password: (auto-generate secure password)
3. Assign the user to an employee record in SQL:
   ```sql
   UPDATE employees
   SET email = 'newemail@company.test'
   WHERE id = '<employee-id>';
   ```

### Generate Payroll

1. Login as admin
2. Go to Payroll → Employees
3. Click "Generate Payroll"
4. Select month/year
5. System calculates based on attendance
6. Review and approve
7. Generate payslips

### Export Payroll Report

1. Go to Payroll → Reports
2. Select date range
3. Click "Download CSV"

## Troubleshooting

### "No active company" error

- You haven't selected a company yet
- Go to /company-selector to select a company
- Reload the page if stuck

### RLS policy errors (401/403)

- Check RLS policy filters are using correct company_id
- Ensure JWT includes correct user_id

### API not responding (500 errors)

- Check server logs: `npm run dev:server`
- Verify Supabase URL and keys in `.env`
- Ensure Supabase project is active

### Missing test data

- Run validation in `/test` dashboard
- Seed Pristine Energy company with attendencerecords
- Create test users via Supabase Auth

## Contributing

1. Create a branch: `git checkout -b feature/new-feature`
2. Make changes
3. Run tests: Navigate to `/test` and validate
4. Commit with clear message: `git commit -m "[phase-X] Description"`
5. Push and create PR

## Performance Optimization

- RLS policies use indexed `company_id` columns
- Supabase caches auth tokens
- Frontend pagination for large lists (100+ records)
- Lazy-load attendance/payroll data

## Security Considerations

- **RLS Policies**: All table queries filtered by company_id
- **Authentication**: Supabase JWT tokens with row-level constraints
- **API Keys**: Anon key used (respects RLS), service key kept private
- **Password**: Minimum 6 characters (configurable via Supabase)
- **CORS**: Configured for localhost only (update for production)

## Future Enhancements (Phase 10+)

- [ ] Payroll approval workflow with manager sign-off
- [ ] Batch payroll generation for entire company
- [ ] PDF payslip export
- [ ] Payroll history and amendments
- [ ] Leave request tracking
- [ ] Real-time notifications
- [ ] Mobile app
- [ ] Geofence-based attendance
- [ ] Integration with payment gateways

## License

Proprietary - Accenture / Pristine Energy

## Support

For issues or questions, contact the development team or check the `/test` dashboard for validation tools.

---

**Last Updated**: May 3, 2026  
**Latest Phase**: Phase 8 - Testing & Validation  
**Total Features**: 29+ completed tasks

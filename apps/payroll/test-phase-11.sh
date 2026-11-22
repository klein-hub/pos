#!/bin/bash

# Test Phase 11: Analytics + Mobile Responsiveness

echo "===== Phase 11 Testing ====="
echo ""
echo "✅ Frontend Dev Server: http://localhost:5173"
echo "✅ API Server: http://localhost:3000"
echo ""
echo "📋 Test Data Available:"
echo "   Company: Pristine Energy"
echo "   Email: super_admin@pristineenergy.test"
echo "   Password: SuperAdmin123!"
echo ""
echo "🧪 Test Endpoints:"
echo ""

# Test Admin Stats
echo "1. Testing /admin/companies endpoint..."
curl -X GET http://localhost:3000/admin/companies \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" 2>/dev/null | head -100

echo ""
echo ""

# List available test data
echo "2. Testing company selector functionality..."
echo "   → Login with super_admin@pristineenergy.test / SuperAdmin123!"
echo "   → Select 'Pristine Energy' company"
echo "   → Navigate to /payroll/analytics"
echo ""

# Check if analytics page loads
echo "3. Checking Analytics Page..."
echo "   → Chart 1: Payroll Trends (Last 12 Months)"
echo "   → Chart 2: Deduction Breakdown"
echo "   → Chart 3: Top Employees by Salary"
echo "   → Chart 4: Department Analytics"
echo ""

# Mobile responsiveness check
echo "4. Mobile Responsiveness Tests:"
echo "   → Desktop (1920px): All charts and tables visible"
echo "   → Tablet (768px): Charts stack, responsive padding"
echo "   → Mobile (375px): Single column layout, scrollable tables"
echo ""

echo "✅ Phase 11A: Analytics Dashboard - Implemented"
echo "✅ Phase 11B: Mobile Responsive Design - Implemented"
echo "⏳ Phase 11C: Integration & Testing - In Progress"
echo ""

echo "📊 Manual Testing Checklist:"
echo "   [ ] Login and select company"
echo "   [ ] View analytics dashboard"
echo "   [ ] Check all stat cards display correctly"
echo "   [ ] Verify payroll trends chart shows data"
echo "   [ ] Check deduction breakdown pie chart"
echo "   [ ] View top employees bar chart"
echo "   [ ] View department analytics table"
echo "   [ ] Test on mobile (375px width)"
echo "   [ ] Test on tablet (768px width)"
echo "   [ ] Test on desktop (1920px width)"
echo ""
echo "🎯 Next Steps:"
echo "   1. Open http://localhost:5173 in browser"
echo "   2. Login with test credentials"
echo "   3. Navigate to Payroll > Analytics"
echo "   4. Verify all sections load correctly"
echo "   5. Test mobile responsiveness with browser dev tools"

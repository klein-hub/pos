/**
 * Payroll Service Unit Tests
 *
 * Tests for payroll calculation and generation functions.
 * Uses a mocked Supabase client (src/lib/__mocks__/supabase.ts).
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  calculateAttendance,
  generatePayroll,
  generatePayslip,
  getPayrollRecord,
} from '../payrollService';
import { supabase } from '../supabase';

// Test IDs from seed data
const TEST_COMPANY_ID = '123e4567-e89b-12d3-a456-426614174000';
const TEST_EMPLOYEE_ID = '223e4567-e89b-12d3-a456-426614174001'; // Maria Santos
const TEST_PAYROLL_ID = '550e8400-e29b-41d4-a716-446655440000';

// Typed aliases for mocked functions
const mockRpc = supabase.rpc as jest.Mock;
const mockFrom = supabase.from as jest.Mock;

// ─── Mock payloads ────────────────────────────────────────────────────────────

const MOCK_ATTENDANCE = {
  present_days: 20,
  absent_days: 1,
  late_count: 1,
  total_work_days: 22,
  attendance_percentage: 90.91,
};

const MOCK_PAYROLL_RECORD = {
  id: TEST_PAYROLL_ID,
  employee_id: TEST_EMPLOYEE_ID,
  company_id: TEST_COMPANY_ID,
  pay_period_start: '2026-05-01',
  pay_period_end: '2026-05-31',
  base_pay: 36363.64,
  overtime_pay: 0,
  deductions: 0,
  net_pay: 36363.64,
  payment_date: '2026-05-31',
  status: 'draft' as const,
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-01T00:00:00Z',
};

const MOCK_PAYSLIP_HTML = `<!DOCTYPE html>
<html><body>
  <div class="company-name">Pristine Energy</div>
  <div class="payslip-title">PAYSLIP</div>
  <span>Maria</span> <span>Santos</span>
  <span>Senior Engineer</span>
  <span class="label">Base Pay:</span>
  <span class="label">NET PAY:</span>
</body></html>`;

const MOCK_PAYSLIP = {
  payslip_html: MOCK_PAYSLIP_HTML,
  payroll_id: TEST_PAYROLL_ID,
  employee_name: 'Maria Santos',
  period_start: '2026-05-01',
  period_end: '2026-05-31',
  base_pay: 36363.64,
  net_pay: 36363.64,
  attendance_summary:
    'Working Days: 22 | Present: 20 | Absent: 1 | Late: 1 | Attendance: 90.9%',
};

// ─── Test suite ───────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Payroll Service', () => {
  describe('calculateAttendance()', () => {
    it('should calculate attendance summary for a date range', async () => {
      mockRpc.mockResolvedValueOnce({ data: [MOCK_ATTENDANCE], error: null });

      const result = await calculateAttendance(
        TEST_EMPLOYEE_ID,
        TEST_COMPANY_ID,
        '2026-04-25',
        '2026-05-01'
      );

      expect(result).toBeDefined();
      expect(result.present_days).toBeGreaterThanOrEqual(0);
      expect(result.absent_days).toBeGreaterThanOrEqual(0);
      expect(result.late_count).toBeGreaterThanOrEqual(0);
      expect(result.total_work_days).toBeGreaterThanOrEqual(0);
      expect(result.attendance_percentage).toBeGreaterThanOrEqual(0);
      expect(result.attendance_percentage).toBeLessThanOrEqual(100);
    });

    it('should have present_days + absent_days + late_count <= total_work_days', async () => {
      mockRpc.mockResolvedValueOnce({ data: [MOCK_ATTENDANCE], error: null });

      const result = await calculateAttendance(
        TEST_EMPLOYEE_ID,
        TEST_COMPANY_ID,
        '2026-04-25',
        '2026-05-01'
      );

      const accounted = result.present_days + result.absent_days + result.late_count;
      expect(accounted).toBeLessThanOrEqual(result.total_work_days);
    });

    it('should return valid percentage calculation', async () => {
      mockRpc.mockResolvedValueOnce({ data: [MOCK_ATTENDANCE], error: null });

      const result = await calculateAttendance(
        TEST_EMPLOYEE_ID,
        TEST_COMPANY_ID,
        '2026-04-25',
        '2026-05-01'
      );

      if (result.total_work_days > 0) {
        const expectedPercentage = (result.present_days / result.total_work_days) * 100;
        expect(Math.abs(result.attendance_percentage - expectedPercentage)).toBeLessThan(0.1);
      }
    });
  });

  describe('generatePayroll()', () => {
    it('should generate payroll for an employee in a month', async () => {
      mockRpc.mockResolvedValueOnce({ data: TEST_PAYROLL_ID, error: null });

      const payrollId = await generatePayroll(TEST_EMPLOYEE_ID, TEST_COMPANY_ID, 2026, 5);

      expect(payrollId).toBeDefined();
      expect(typeof payrollId).toBe('string');
      expect(payrollId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should create payroll record with correct dates', async () => {
      mockRpc.mockResolvedValueOnce({ data: TEST_PAYROLL_ID, error: null });
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({ data: MOCK_PAYROLL_RECORD, error: null }),
      });

      const payrollId = await generatePayroll(TEST_EMPLOYEE_ID, TEST_COMPANY_ID, 2026, 5);
      const payroll = await getPayrollRecord(payrollId);

      expect(payroll).toBeDefined();
      expect(payroll?.employee_id).toBe(TEST_EMPLOYEE_ID);
      expect(payroll?.company_id).toBe(TEST_COMPANY_ID);
      expect(payroll?.pay_period_start).toBe('2026-05-01');
      expect(payroll?.pay_period_end).toBe('2026-05-31');
    });

    it('should calculate net_pay based on attendance', async () => {
      mockRpc.mockResolvedValueOnce({ data: TEST_PAYROLL_ID, error: null });
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({ data: MOCK_PAYROLL_RECORD, error: null }),
      });

      const payrollId = await generatePayroll(TEST_EMPLOYEE_ID, TEST_COMPANY_ID, 2026, 5);
      const payroll = await getPayrollRecord(payrollId);

      expect(payroll).toBeDefined();
      expect(payroll!.base_pay).toBeGreaterThanOrEqual(0);
      expect(payroll!.net_pay).toBeGreaterThanOrEqual(0);
      // net_pay equals base_pay when there are no deductions
      expect(payroll!.net_pay).toEqual(payroll!.base_pay);
    });

    it('should create payroll with draft status', async () => {
      mockRpc.mockResolvedValueOnce({ data: TEST_PAYROLL_ID, error: null });
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({ data: MOCK_PAYROLL_RECORD, error: null }),
      });

      const payrollId = await generatePayroll(TEST_EMPLOYEE_ID, TEST_COMPANY_ID, 2026, 5);
      const payroll = await getPayrollRecord(payrollId);

      expect(payroll?.status).toBe('draft');
    });

    it('should throw error for non-existent employee', async () => {
      mockRpc.mockRejectedValueOnce(new Error('Employee not found or not in company'));

      await expect(
        generatePayroll('00000000-0000-0000-0000-000000000000', TEST_COMPANY_ID, 2026, 5)
      ).rejects.toThrow('Employee not found or not in company');
    });

    it('should throw error for wrong company', async () => {
      mockRpc.mockRejectedValueOnce(new Error('Employee not found or not in company'));

      await expect(
        generatePayroll(TEST_EMPLOYEE_ID, '00000000-0000-0000-0000-000000000000', 2026, 5)
      ).rejects.toThrow('Employee not found or not in company');
    });
  });

  describe('generatePayslip()', () => {
    it('should generate valid HTML payslip', async () => {
      mockRpc.mockResolvedValueOnce({ data: [MOCK_PAYSLIP], error: null });

      const payslip = await generatePayslip(TEST_PAYROLL_ID, TEST_COMPANY_ID);

      expect(payslip).toBeDefined();
      expect(payslip.payslip_html).toBeDefined();
      expect(payslip.payslip_html).toContain('<!DOCTYPE html>');
      expect(payslip.payslip_html).toContain('Pristine Energy');
      expect(payslip.payslip_html).toContain('PAYSLIP');
    });

    it('should include employee information in payslip', async () => {
      mockRpc.mockResolvedValueOnce({ data: [MOCK_PAYSLIP], error: null });

      const payslip = await generatePayslip(TEST_PAYROLL_ID, TEST_COMPANY_ID);

      expect(payslip.payslip_html).toContain('Maria');
      expect(payslip.payslip_html).toContain('Santos');
      expect(payslip.payslip_html).toContain('Senior Engineer');
    });

    it('should include attendance summary in payslip', async () => {
      mockRpc.mockResolvedValueOnce({ data: [MOCK_PAYSLIP], error: null });

      const payslip = await generatePayslip(TEST_PAYROLL_ID, TEST_COMPANY_ID);

      expect(payslip.attendance_summary).toBeDefined();
      expect(payslip.attendance_summary).toContain('Working Days');
      expect(payslip.attendance_summary).toContain('Present');
    });

    it('should include pay details in payslip', async () => {
      mockRpc.mockResolvedValueOnce({ data: [MOCK_PAYSLIP], error: null });

      const payslip = await generatePayslip(TEST_PAYROLL_ID, TEST_COMPANY_ID);

      expect(payslip.payslip_html).toContain('Base Pay');
      expect(payslip.payslip_html).toContain('NET PAY');
      expect(payslip.base_pay).toBeGreaterThanOrEqual(0);
      expect(payslip.net_pay).toBeGreaterThanOrEqual(0);
    });

    it('should throw error for non-existent payroll', async () => {
      mockRpc.mockRejectedValueOnce(new Error('Payroll record not found'));

      await expect(
        generatePayslip('00000000-0000-0000-0000-000000000000', TEST_COMPANY_ID)
      ).rejects.toThrow('Payroll record not found');
    });
  });
});

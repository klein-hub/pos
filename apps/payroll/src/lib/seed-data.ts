import { supabase } from './supabase';

async function seedData() {
  // Insert employees
  const { data: employees, error: employeesError } = await supabase
    .from('employees')
    .insert([
      {
        first_name: 'Sarah',
        last_name: 'Johnson',
        email: 'sarah.johnson@company.com',
        position: 'Senior Software Engineer',
        department: 'Engineering',
        hire_date: '2023-06-15',
        base_salary: 95000
      },
      {
        first_name: 'Michael',
        last_name: 'Chen',
        email: 'michael.chen@company.com',
        position: 'Marketing Manager',
        department: 'Marketing',
        hire_date: '2023-08-01',
        base_salary: 85000
      },
      {
        first_name: 'Emily',
        last_name: 'Rodriguez',
        email: 'emily.rodriguez@company.com',
        position: 'Financial Analyst',
        department: 'Finance',
        hire_date: '2023-09-15',
        base_salary: 75000
      }
    ])
    .select();

  if (employeesError) {
    console.error('Error inserting employees:', employeesError);
    return;
  }

  // Insert payroll records for each employee
  for (const employee of employees) {
    const { error: payrollError } = await supabase
      .from('payroll_records')
      .insert([
        {
          employee_id: employee.id,
          pay_period_start: '2024-01-01',
          pay_period_end: '2024-01-15',
          base_pay: employee.base_salary / 24, // Bi-monthly pay
          overtime_pay: 0,
          deductions: (employee.base_salary / 24) * 0.3, // 30% for taxes and benefits
          net_pay: (employee.base_salary / 24) * 0.7,
          payment_date: '2024-01-15',
          status: 'paid'
        },
        {
          employee_id: employee.id,
          pay_period_start: '2024-01-16',
          pay_period_end: '2024-01-31',
          base_pay: employee.base_salary / 24,
          overtime_pay: 0,
          deductions: (employee.base_salary / 24) * 0.3,
          net_pay: (employee.base_salary / 24) * 0.7,
          payment_date: '2024-01-31',
          status: 'paid'
        },
        {
          employee_id: employee.id,
          pay_period_start: '2024-02-01',
          pay_period_end: '2024-02-15',
          base_pay: employee.base_salary / 24,
          overtime_pay: 0,
          deductions: (employee.base_salary / 24) * 0.3,
          net_pay: (employee.base_salary / 24) * 0.7,
          payment_date: '2024-02-15',
          status: 'processed'
        }
      ]);

    if (payrollError) {
      console.error('Error inserting payroll records:', payrollError);
      return;
    }
  }

  console.log('Data seeding completed successfully!');
}

export default seedData;
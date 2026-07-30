const express = require('express');
const router = express.Router();
const { supabase, assertNoError } = require('../database/supabase');

const {
  countEmployeeLinks,
  employeeDeleteBlockedMessage,
  isFkViolation,
  genericFkMessage,
} = require('../utils/recordLifecycle');

const ROLES = ['Salesman', 'Manager', 'Accountant', 'Delivery Boy'];
const STATUSES = ['Active', 'Inactive'];

function currentMonthKey() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${month}`;
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function validateEmployeeBody(body, { partial = false } = {}) {
  const { name, role, contact, salary, joining_date, status } = body;

  if (!partial) {
    if (!name?.trim()) return 'Employee name is required';
    if (!role) return 'Role is required';
    if (salary === undefined || salary === null || salary === '') return 'Monthly salary is required';
    if (!joining_date) return 'Joining date is required';
    if (!status) return 'Status is required';
  }

  if (role !== undefined && !ROLES.includes(role)) {
    return `Role must be one of: ${ROLES.join(', ')}`;
  }

  if (status !== undefined && !STATUSES.includes(status)) {
    return 'Status must be Active or Inactive';
  }

  if (salary !== undefined && salary !== null && salary !== '' && Number(salary) < 0) {
    return 'Salary cannot be negative';
  }

  return null;
}

function attachSalaryStatus(employees, payments) {
  const paidByEmployee = new Map();
  for (const p of payments || []) {
    paidByEmployee.set(p.employee_id, p);
  }

  return (employees || []).map((emp) => {
    const payment = paidByEmployee.get(emp.id);
    return {
      ...emp,
      salary_paid_this_month: Boolean(payment),
      salary_payment: payment
        ? {
            id: payment.id,
            month: payment.month,
            amount: Number(payment.amount),
            paid_date: payment.paid_date,
          }
        : null,
    };
  });
}

router.get('/', async (req, res) => {
  try {
    const month = currentMonthKey();

    const [employeesRes, paymentsRes] = await Promise.all([
      supabase.from('employees').select('*').order('name'),
      supabase.from('salary_payments').select('*').eq('month', month),
    ]);

    assertNoError(employeesRes.error);
    assertNoError(paymentsRes.error);

    const employees = attachSalaryStatus(employeesRes.data, paymentsRes.data);
    res.json(employees);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/deactivate', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('employees')
      .update({ status: 'Inactive' })
      .eq('id', id)
      .select()
      .maybeSingle();

    assertNoError(error);
    if (!data) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json({ message: 'Employee deactivated successfully', employee: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/reactivate', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('employees')
      .update({ status: 'Active' })
      .eq('id', id)
      .select()
      .maybeSingle();

    assertNoError(error);
    if (!data) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json({ message: 'Employee reactivated successfully', employee: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const month = currentMonthKey();
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    assertNoError(error);
    if (!data) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const { data: payment, error: payError } = await supabase
      .from('salary_payments')
      .select('*')
      .eq('employee_id', data.id)
      .eq('month', month)
      .maybeSingle();

    assertNoError(payError);

    res.json(
      attachSalaryStatus([data], payment ? [payment] : [])[0]
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const validationError = validateEmployeeBody(req.body);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const { name, role, contact, salary, joining_date, status } = req.body;

    const { data, error } = await supabase
      .from('employees')
      .insert({
        name: name.trim(),
        role,
        contact: contact?.trim() || '',
        salary: Number(salary),
        joining_date,
        status,
      })
      .select()
      .single();

    assertNoError(error);
    res.status(201).json({ ...data, salary_paid_this_month: false, salary_payment: null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const validationError = validateEmployeeBody(req.body, { partial: true });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const { id } = req.params;
    const { data: existing, error: fetchError } = await supabase
      .from('employees')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    assertNoError(fetchError);
    if (!existing) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const { name, role, contact, salary, joining_date, status } = req.body;

    const { data, error } = await supabase
      .from('employees')
      .update({
        name: name !== undefined ? name.trim() : existing.name,
        role: role ?? existing.role,
        contact: contact !== undefined ? contact.trim() : existing.contact,
        salary: salary !== undefined ? Number(salary) : existing.salary,
        joining_date: joining_date ?? existing.joining_date,
        status: status ?? existing.status,
      })
      .eq('id', id)
      .select()
      .single();

    assertNoError(error);

    const month = currentMonthKey();
    const { data: payment } = await supabase
      .from('salary_payments')
      .select('*')
      .eq('employee_id', id)
      .eq('month', month)
      .maybeSingle();

    res.json(attachSalaryStatus([data], payment ? [payment] : [])[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: existing, error: fetchError } = await supabase
      .from('employees')
      .select('id, name')
      .eq('id', id)
      .maybeSingle();

    assertNoError(fetchError);
    if (!existing) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const links = await countEmployeeLinks(supabase, id);
    const blockedMessage = employeeDeleteBlockedMessage(links);
    if (blockedMessage) {
      return res.status(409).json({
        error: blockedMessage,
        code: 'LINKED_RECORDS',
        links,
      });
    }

    const { data, error } = await supabase.from('employees').delete().eq('id', id).select('id');

    if (error) {
      if (isFkViolation(error)) {
        return res.status(409).json({
          error: employeeDeleteBlockedMessage(links) || genericFkMessage('employee'),
          code: 'LINKED_RECORDS',
        });
      }
      assertNoError(error);
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    if (isFkViolation(error)) {
      return res.status(409).json({ error: genericFkMessage('employee'), code: 'LINKED_RECORDS' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/mark-salary-paid', async (req, res) => {
  try {
    const { id } = req.params;
    const month = currentMonthKey();

    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    assertNoError(empError);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    if (employee.status !== 'Active') {
      return res.status(400).json({ error: 'Cannot mark salary paid for an inactive employee' });
    }

    const { data: existing, error: existingError } = await supabase
      .from('salary_payments')
      .select('*')
      .eq('employee_id', id)
      .eq('month', month)
      .maybeSingle();

    assertNoError(existingError);
    if (existing) {
      return res.status(409).json({ error: 'Salary for this month is already marked as paid' });
    }

    const amount = Number(employee.salary);
    const { data: payment, error: insertError } = await supabase
      .from('salary_payments')
      .insert({
        employee_id: Number(id),
        month,
        amount,
        paid_date: todayISO(),
      })
      .select()
      .single();

    assertNoError(insertError);

    res.status(201).json({
      employee: attachSalaryStatus([employee], [payment])[0],
      payment,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

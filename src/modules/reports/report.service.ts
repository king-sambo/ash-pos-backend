/**
 * Reports Service
 * Comprehensive reporting for sales, inventory, customers, and discounts
 */

import { pool } from "../../config/database";

interface DateRange {
  startDate: string;
  endDate: string;
}

// ============ SALES REPORTS ============

export async function getSalesSummary(dateRange: DateRange) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 
        COUNT(*) as total_transactions,
        COALESCE(SUM(total_amount), 0) as total_sales,
        COALESCE(SUM(discount_amount), 0) as total_discounts,
        COALESCE(SUM(tax_amount), 0) as total_tax,
        COALESCE(SUM(total_amount - discount_amount), 0) as net_sales,
        COALESCE(AVG(total_amount), 0) as average_ticket,
        COUNT(CASE WHEN status = 'voided' THEN 1 END) as voided_count,
        COALESCE(SUM(CASE WHEN status = 'voided' THEN total_amount ELSE 0 END), 0) as voided_amount
      FROM sales
      WHERE created_at >= $1::date AND created_at < ($2::date + interval '1 day')
        AND status != 'voided'`,
      [dateRange.startDate, dateRange.endDate]
    );

    const row = result.rows[0];
    return {
      totalTransactions: parseInt(row.total_transactions),
      totalSales: parseFloat(row.total_sales),
      totalDiscounts: parseFloat(row.total_discounts),
      totalTax: parseFloat(row.total_tax),
      netSales: parseFloat(row.net_sales),
      averageTicket: parseFloat(row.average_ticket),
      voidedCount: parseInt(row.voided_count),
      voidedAmount: parseFloat(row.voided_amount),
    };
  } finally {
    client.release();
  }
}

export async function getDailySales(dateRange: DateRange) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as transactions,
        COALESCE(SUM(total_amount), 0) as total_sales,
        COALESCE(SUM(discount_amount), 0) as total_discounts,
        COALESCE(AVG(total_amount), 0) as average_ticket
      FROM sales
      WHERE created_at >= $1::date AND created_at < ($2::date + interval '1 day')
        AND status != 'voided'
      GROUP BY DATE(created_at)
      ORDER BY date`,
      [dateRange.startDate, dateRange.endDate]
    );

    return result.rows.map((row) => ({
      date: row.date,
      transactions: parseInt(row.transactions),
      totalSales: parseFloat(row.total_sales),
      totalDiscounts: parseFloat(row.total_discounts),
      averageTicket: parseFloat(row.average_ticket),
    }));
  } finally {
    client.release();
  }
}

export async function getHourlySales(date: string) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 
        EXTRACT(HOUR FROM created_at) as hour,
        COUNT(*) as transactions,
        COALESCE(SUM(total_amount), 0) as total_sales
      FROM sales
      WHERE DATE(created_at) = $1::date AND status != 'voided'
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY hour`,
      [date]
    );

    // Fill in missing hours with zeros
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      transactions: 0,
      totalSales: 0,
    }));

    result.rows.forEach((row) => {
      const hour = parseInt(row.hour);
      hourlyData[hour] = {
        hour,
        transactions: parseInt(row.transactions),
        totalSales: parseFloat(row.total_sales),
      };
    });

    return hourlyData;
  } finally {
    client.release();
  }
}

export async function getSalesByCashier(dateRange: DateRange) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 
        u.id,
        u.first_name || ' ' || u.last_name as cashier_name,
        COUNT(s.*) as transactions,
        COALESCE(SUM(s.total_amount), 0) as total_sales,
        COALESCE(SUM(s.discount_amount), 0) as total_discounts,
        COALESCE(AVG(s.total_amount), 0) as average_ticket
      FROM sales s
      JOIN users u ON s.user_id = u.id
      WHERE s.created_at >= $1::date AND s.created_at < ($2::date + interval '1 day')
        AND s.status != 'voided'
      GROUP BY u.id, u.first_name, u.last_name
      ORDER BY total_sales DESC`,
      [dateRange.startDate, dateRange.endDate]
    );

    return result.rows.map((row) => ({
      id: row.id,
      cashierName: row.cashier_name,
      transactions: parseInt(row.transactions),
      totalSales: parseFloat(row.total_sales),
      totalDiscounts: parseFloat(row.total_discounts),
      averageTicket: parseFloat(row.average_ticket),
    }));
  } finally {
    client.release();
  }
}

export async function getSalesByPaymentMethod(dateRange: DateRange) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 
        payment_method,
        COUNT(*) as transactions,
        COALESCE(SUM(total_amount), 0) as total_amount
      FROM sales
      WHERE created_at >= $1::date AND created_at < ($2::date + interval '1 day')
        AND status != 'voided'
      GROUP BY payment_method
      ORDER BY total_amount DESC`,
      [dateRange.startDate, dateRange.endDate]
    );

    return result.rows.map((row) => ({
      paymentMethod: row.payment_method,
      transactions: parseInt(row.transactions),
      totalAmount: parseFloat(row.total_amount),
    }));
  } finally {
    client.release();
  }
}

export async function getSalesByCategory(dateRange: DateRange) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 
        c.id,
        c.name as category_name,
        COUNT(DISTINCT s.id) as transactions,
        COALESCE(SUM(si.quantity), 0) as units_sold,
        COALESCE(SUM(si.total_price), 0) as total_revenue
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      WHERE s.created_at >= $1::date AND s.created_at < ($2::date + interval '1 day')
        AND s.status != 'voided'
      GROUP BY c.id, c.name
      ORDER BY total_revenue DESC`,
      [dateRange.startDate, dateRange.endDate]
    );

    return result.rows.map((row) => ({
      id: row.id,
      categoryName: row.category_name,
      transactions: parseInt(row.transactions),
      unitsSold: parseInt(row.units_sold),
      totalRevenue: parseFloat(row.total_revenue),
    }));
  } finally {
    client.release();
  }
}

// ============ PRODUCT REPORTS ============

export async function getTopSellingProducts(dateRange: DateRange, limit: number = 20) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 
        p.id,
        p.name as product_name,
        p.sku,
        c.name as category_name,
        COALESCE(SUM(si.quantity), 0) as units_sold,
        COALESCE(SUM(si.total_price), 0) as total_revenue,
        COALESCE(SUM(si.total_price - (si.cost_price * si.quantity)), 0) as gross_profit
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE s.created_at >= $1::date AND s.created_at < ($2::date + interval '1 day')
        AND s.status != 'voided'
      GROUP BY p.id, p.name, p.sku, c.name
      ORDER BY units_sold DESC
      LIMIT $3`,
      [dateRange.startDate, dateRange.endDate, limit]
    );

    return result.rows.map((row) => ({
      id: row.id,
      productName: row.product_name,
      sku: row.sku,
      categoryName: row.category_name,
      unitsSold: parseInt(row.units_sold),
      totalRevenue: parseFloat(row.total_revenue),
      grossProfit: parseFloat(row.gross_profit),
    }));
  } finally {
    client.release();
  }
}

export async function getLowStockReport(threshold?: number) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 
        p.id,
        p.name,
        p.sku,
        c.name as category_name,
        p.current_stock,
        p.low_stock_threshold,
        p.cost_price,
        p.selling_price
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.status = 'active' 
        AND p.track_inventory = TRUE
        AND p.current_stock <= COALESCE($1, p.low_stock_threshold)
      ORDER BY p.current_stock ASC`,
      [threshold]
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      sku: row.sku,
      categoryName: row.category_name,
      currentStock: parseInt(row.current_stock),
      lowStockThreshold: parseInt(row.low_stock_threshold),
      costPrice: parseFloat(row.cost_price),
      sellingPrice: parseFloat(row.selling_price),
    }));
  } finally {
    client.release();
  }
}

export async function getInventoryValue() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        COUNT(*) as total_products,
        COALESCE(SUM(current_stock), 0) as total_units,
        COALESCE(SUM(current_stock * cost_price), 0) as total_cost_value,
        COALESCE(SUM(current_stock * selling_price), 0) as total_retail_value,
        COUNT(CASE WHEN current_stock <= low_stock_threshold THEN 1 END) as low_stock_count,
        COUNT(CASE WHEN current_stock = 0 THEN 1 END) as out_of_stock_count
      FROM products
      WHERE status = 'active' AND track_inventory = TRUE
    `);

    const row = result.rows[0];
    return {
      totalProducts: parseInt(row.total_products),
      totalUnits: parseInt(row.total_units),
      totalCostValue: parseFloat(row.total_cost_value),
      totalRetailValue: parseFloat(row.total_retail_value),
      potentialProfit: parseFloat(row.total_retail_value) - parseFloat(row.total_cost_value),
      lowStockCount: parseInt(row.low_stock_count),
      outOfStockCount: parseInt(row.out_of_stock_count),
    };
  } finally {
    client.release();
  }
}

export async function getStockMovementReport(dateRange: DateRange) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 
        movement_type,
        COUNT(*) as count,
        COALESCE(SUM(ABS(quantity)), 0) as total_quantity
      FROM stock_movements
      WHERE created_at >= $1::date AND created_at < ($2::date + interval '1 day')
      GROUP BY movement_type
      ORDER BY count DESC`,
      [dateRange.startDate, dateRange.endDate]
    );

    return result.rows.map((row) => ({
      movementType: row.movement_type,
      count: parseInt(row.count),
      totalQuantity: parseInt(row.total_quantity),
    }));
  } finally {
    client.release();
  }
}

// ============ CUSTOMER REPORTS ============

export async function getTopCustomers(dateRange: DateRange, limit: number = 20) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 
        c.id,
        c.first_name || ' ' || c.last_name as customer_name,
        c.customer_code,
        mt.name as membership_tier,
        COUNT(s.*) as transactions,
        COALESCE(SUM(s.total_amount), 0) as total_spent,
        COALESCE(AVG(s.total_amount), 0) as average_ticket
      FROM customers c
      JOIN sales s ON s.customer_id = c.id
      LEFT JOIN membership_tiers mt ON c.membership_tier_id = mt.id
      WHERE s.created_at >= $1::date AND s.created_at < ($2::date + interval '1 day')
        AND s.status != 'voided'
      GROUP BY c.id, c.first_name, c.last_name, c.customer_code, mt.name
      ORDER BY total_spent DESC
      LIMIT $3`,
      [dateRange.startDate, dateRange.endDate, limit]
    );

    return result.rows.map((row) => ({
      id: row.id,
      customerName: row.customer_name,
      customerCode: row.customer_code,
      membershipTier: row.membership_tier,
      transactions: parseInt(row.transactions),
      totalSpent: parseFloat(row.total_spent),
      averageTicket: parseFloat(row.average_ticket),
    }));
  } finally {
    client.release();
  }
}

export async function getMembershipDistribution() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        COALESCE(mt.name, 'No Membership') as tier_name,
        COUNT(c.*) as customer_count,
        COALESCE(SUM(c.lifetime_spend), 0) as total_lifetime_spend,
        COALESCE(AVG(c.loyalty_points), 0) as avg_loyalty_points
      FROM customers c
      LEFT JOIN membership_tiers mt ON c.membership_tier_id = mt.id
      WHERE c.is_active = TRUE AND c.deleted_at IS NULL
      GROUP BY mt.name, mt.sort_order
      ORDER BY mt.sort_order NULLS LAST
    `);

    return result.rows.map((row) => ({
      tierName: row.tier_name,
      customerCount: parseInt(row.customer_count),
      totalLifetimeSpend: parseFloat(row.total_lifetime_spend),
      avgLoyaltyPoints: parseFloat(row.avg_loyalty_points),
    }));
  } finally {
    client.release();
  }
}

export async function getNewCustomers(dateRange: DateRange) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as new_customers
      FROM customers
      WHERE created_at >= $1::date AND created_at < ($2::date + interval '1 day')
        AND deleted_at IS NULL
      GROUP BY DATE(created_at)
      ORDER BY date`,
      [dateRange.startDate, dateRange.endDate]
    );

    return result.rows.map((row) => ({
      date: row.date,
      newCustomers: parseInt(row.new_customers),
    }));
  } finally {
    client.release();
  }
}

// ============ DISCOUNT REPORTS ============

export async function getDiscountSummary(dateRange: DateRange) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 
        discount_type,
        COUNT(*) as usage_count,
        COALESCE(SUM(discount_amount), 0) as total_discount
      FROM sale_discounts sd
      JOIN sales s ON sd.sale_id = s.id
      WHERE s.created_at >= $1::date AND s.created_at < ($2::date + interval '1 day')
        AND s.status != 'voided'
      GROUP BY discount_type
      ORDER BY total_discount DESC`,
      [dateRange.startDate, dateRange.endDate]
    );

    const totalDiscount = result.rows.reduce((sum, row) => sum + parseFloat(row.total_discount), 0);

    return {
      totalDiscount,
      byType: result.rows.map((row) => ({
        discountType: row.discount_type,
        usageCount: parseInt(row.usage_count),
        totalDiscount: parseFloat(row.total_discount),
        percentage: totalDiscount > 0 ? (parseFloat(row.total_discount) / totalDiscount) * 100 : 0,
      })),
    };
  } finally {
    client.release();
  }
}

export async function getScPwdReport(dateRange: DateRange) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 
        s.id,
        s.invoice_number,
        s.created_at,
        c.first_name || ' ' || c.last_name as customer_name,
        CASE 
          WHEN c.is_senior_citizen THEN 'Senior Citizen'
          WHEN c.is_pwd THEN 'PWD'
          ELSE 'Other'
        END as discount_type,
        CASE 
          WHEN c.is_senior_citizen THEN c.senior_citizen_id
          WHEN c.is_pwd THEN c.pwd_id
          ELSE NULL
        END as id_number,
        s.subtotal,
        s.discount_amount,
        s.vat_exempt_amount,
        s.total_amount
      FROM sales s
      JOIN customers c ON s.customer_id = c.id
      WHERE s.created_at >= $1::date AND s.created_at < ($2::date + interval '1 day')
        AND s.status != 'voided'
        AND s.is_vat_exempt = TRUE
        AND (c.is_senior_citizen = TRUE OR c.is_pwd = TRUE)
      ORDER BY s.created_at DESC`,
      [dateRange.startDate, dateRange.endDate]
    );

    // Summary
    const summary = await client.query(
      `SELECT 
        COUNT(*) as total_transactions,
        COALESCE(SUM(s.discount_amount), 0) as total_discount,
        COALESCE(SUM(s.vat_exempt_amount), 0) as total_vat_exempt,
        COUNT(CASE WHEN c.is_senior_citizen THEN 1 END) as sc_count,
        COUNT(CASE WHEN c.is_pwd THEN 1 END) as pwd_count
      FROM sales s
      JOIN customers c ON s.customer_id = c.id
      WHERE s.created_at >= $1::date AND s.created_at < ($2::date + interval '1 day')
        AND s.status != 'voided'
        AND s.is_vat_exempt = TRUE
        AND (c.is_senior_citizen = TRUE OR c.is_pwd = TRUE)`,
      [dateRange.startDate, dateRange.endDate]
    );

    const summaryRow = summary.rows[0];

    return {
      summary: {
        totalTransactions: parseInt(summaryRow.total_transactions),
        totalDiscount: parseFloat(summaryRow.total_discount),
        totalVatExempt: parseFloat(summaryRow.total_vat_exempt),
        seniorCitizenCount: parseInt(summaryRow.sc_count),
        pwdCount: parseInt(summaryRow.pwd_count),
      },
      transactions: result.rows.map((row) => ({
        id: row.id,
        invoiceNumber: row.invoice_number,
        createdAt: row.created_at,
        customerName: row.customer_name,
        discountType: row.discount_type,
        idNumber: row.id_number,
        subtotal: parseFloat(row.subtotal),
        discountAmount: parseFloat(row.discount_amount),
        vatExemptAmount: parseFloat(row.vat_exempt_amount),
        totalAmount: parseFloat(row.total_amount),
      })),
    };
  } finally {
    client.release();
  }
}

export async function getManualDiscountAudit(dateRange: DateRange) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 
        sd.id,
        s.invoice_number,
        s.created_at,
        sd.discount_name,
        sd.discount_percentage,
        sd.discount_amount,
        sd.reason,
        u.first_name || ' ' || u.last_name as cashier_name,
        approver.first_name || ' ' || approver.last_name as approved_by_name
      FROM sale_discounts sd
      JOIN sales s ON sd.sale_id = s.id
      JOIN users u ON s.user_id = u.id
      LEFT JOIN users approver ON sd.approved_by = approver.id
      WHERE s.created_at >= $1::date AND s.created_at < ($2::date + interval '1 day')
        AND sd.discount_type = 'manual'
        AND s.status != 'voided'
      ORDER BY s.created_at DESC`,
      [dateRange.startDate, dateRange.endDate]
    );

    return result.rows.map((row) => ({
      id: row.id,
      invoiceNumber: row.invoice_number,
      createdAt: row.created_at,
      discountName: row.discount_name,
      discountPercentage: row.discount_percentage ? parseFloat(row.discount_percentage) : null,
      discountAmount: parseFloat(row.discount_amount),
      reason: row.reason,
      cashierName: row.cashier_name,
      approvedByName: row.approved_by_name,
    }));
  } finally {
    client.release();
  }
}

// ============ VOIDED TRANSACTIONS ============

export async function getVoidedTransactions(dateRange: DateRange) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 
        s.id,
        s.invoice_number,
        s.created_at,
        s.voided_at,
        s.total_amount,
        s.void_reason,
        cashier.first_name || ' ' || cashier.last_name as cashier_name,
        voider.first_name || ' ' || voider.last_name as voided_by_name,
        supervisor.first_name || ' ' || supervisor.last_name as authorized_by_name
      FROM sales s
      JOIN users cashier ON s.user_id = cashier.id
      LEFT JOIN users voider ON s.voided_by = voider.id
      LEFT JOIN users supervisor ON s.void_authorized_by = supervisor.id
      WHERE s.voided_at >= $1::date AND s.voided_at < ($2::date + interval '1 day')
        AND s.status = 'voided'
      ORDER BY s.voided_at DESC`,
      [dateRange.startDate, dateRange.endDate]
    );

    return result.rows.map((row) => ({
      id: row.id,
      invoiceNumber: row.invoice_number,
      createdAt: row.created_at,
      voidedAt: row.voided_at,
      totalAmount: parseFloat(row.total_amount),
      voidReason: row.void_reason,
      cashierName: row.cashier_name,
      voidedByName: row.voided_by_name,
      authorizedByName: row.authorized_by_name,
    }));
  } finally {
    client.release();
  }
}

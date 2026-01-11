/**
 * Dashboard Service
 * Provides statistics and analytics data for the dashboard
 */

import { pool } from "../../config/database";

export interface DashboardStats {
  todaySales: number;
  todayTransactions: number;
  averageTicket: number;
  yesterdaySales: number;
  salesGrowth: number;
  lowStockCount: number;
  activePromotions: number;
  totalCustomers: number;
}

export interface SalesTrend {
  date: string;
  sales: number;
  transactions: number;
}

export interface TopProduct {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  revenue: number;
  imageUrl: string | null;
}

export interface LowStockProduct {
  id: string;
  name: string;
  sku: string;
  stockQuantity: number;
  minStockLevel: number;
  imageUrl: string | null;
}

export interface RecentTransaction {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  paymentMethod: string;
  customerName: string | null;
  cashierName: string;
  createdAt: string;
  status: string;
}

export interface HourlySales {
  hour: number;
  sales: number;
  transactions: number;
}

/**
 * Get dashboard summary statistics
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const client = await pool.connect();
  
  try {
    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Today's sales
    const todaySalesResult = await client.query(`
      SELECT 
        COALESCE(SUM(total_amount), 0) as total_sales,
        COUNT(*) as transaction_count
      FROM sales 
      WHERE created_at >= $1 AND created_at < $2
        AND status = 'completed'
    `, [today.toISOString(), tomorrow.toISOString()]);

    const todaySales = parseFloat(todaySalesResult.rows[0]?.total_sales || 0);
    const todayTransactions = parseInt(todaySalesResult.rows[0]?.transaction_count || 0);
    const averageTicket = todayTransactions > 0 ? todaySales / todayTransactions : 0;

    // Yesterday's sales for comparison
    const yesterdaySalesResult = await client.query(`
      SELECT COALESCE(SUM(total_amount), 0) as total_sales
      FROM sales 
      WHERE created_at >= $1 AND created_at < $2
        AND status = 'completed'
    `, [yesterday.toISOString(), today.toISOString()]);

    const yesterdaySales = parseFloat(yesterdaySalesResult.rows[0]?.total_sales || 0);
    const salesGrowth = yesterdaySales > 0 
      ? ((todaySales - yesterdaySales) / yesterdaySales) * 100 
      : todaySales > 0 ? 100 : 0;

    // Low stock count
    const lowStockResult = await client.query(`
      SELECT COUNT(*) as count
      FROM products 
      WHERE current_stock <= low_stock_threshold 
        AND status = 'active'
    `);
    const lowStockCount = parseInt(lowStockResult.rows[0]?.count || 0);

    // Active promotions count
    const promotionsResult = await client.query(`
      SELECT COUNT(*) as count
      FROM promotions 
      WHERE is_active = true 
        AND start_date <= NOW() 
        AND (end_date IS NULL OR end_date >= NOW())
    `);
    const activePromotions = parseInt(promotionsResult.rows[0]?.count || 0);

    // Total customers
    const customersResult = await client.query(`
      SELECT COUNT(*) as count FROM customers WHERE is_active = true
    `);
    const totalCustomers = parseInt(customersResult.rows[0]?.count || 0);

    return {
      todaySales,
      todayTransactions,
      averageTicket,
      yesterdaySales,
      salesGrowth,
      lowStockCount,
      activePromotions,
      totalCustomers,
    };
  } finally {
    client.release();
  }
}

/**
 * Get sales trend for the specified period
 */
export async function getSalesTrend(
  period: "daily" | "weekly" | "monthly" = "daily",
  days: number = 7
): Promise<SalesTrend[]> {
  const client = await pool.connect();
  
  try {
    let dateFormat: string;
    let interval: string;

    switch (period) {
      case "weekly":
        dateFormat = "YYYY-IW"; // ISO week
        interval = `${days * 7} days`;
        break;
      case "monthly":
        dateFormat = "YYYY-MM";
        interval = `${days * 30} days`;
        break;
      default:
        dateFormat = "YYYY-MM-DD";
        interval = `${days} days`;
    }

    const result = await client.query(`
      SELECT 
        TO_CHAR(created_at, $1) as date,
        COALESCE(SUM(total_amount), 0) as sales,
        COUNT(*) as transactions
      FROM sales 
      WHERE created_at >= NOW() - INTERVAL '${interval}'
        AND status = 'completed'
      GROUP BY TO_CHAR(created_at, $1)
      ORDER BY date ASC
    `, [dateFormat]);

    return result.rows.map((row: { date: string; sales: string; transactions: string }) => ({
      date: row.date,
      sales: parseFloat(row.sales),
      transactions: parseInt(row.transactions),
    }));
  } finally {
    client.release();
  }
}

/**
 * Get top selling products
 */
export async function getTopProducts(limit: number = 5): Promise<TopProduct[]> {
  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      SELECT 
        p.id,
        p.name,
        p.sku,
        p.image_url,
        COALESCE(SUM(si.quantity), 0) as quantity,
        COALESCE(SUM(si.total_price), 0) as revenue
      FROM products p
      LEFT JOIN sale_items si ON p.id = si.product_id
      LEFT JOIN sales s ON si.sale_id = s.id AND s.status = 'completed'
      WHERE p.status = 'active'
      GROUP BY p.id, p.name, p.sku, p.image_url
      ORDER BY revenue DESC
      LIMIT $1
    `, [limit]);

    return result.rows.map((row: { id: string; name: string; sku: string; image_url: string | null; quantity: string; revenue: string }) => ({
      id: row.id,
      name: row.name,
      sku: row.sku,
      imageUrl: row.image_url,
      quantity: parseInt(row.quantity),
      revenue: parseFloat(row.revenue),
    }));
  } finally {
    client.release();
  }
}

/**
 * Get low stock products
 */
export async function getLowStockProducts(limit: number = 10): Promise<LowStockProduct[]> {
  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      SELECT 
        id,
        name,
        sku,
        current_stock,
        low_stock_threshold,
        image_url
      FROM products 
      WHERE current_stock <= low_stock_threshold 
        AND status = 'active'
      ORDER BY (current_stock - low_stock_threshold) ASC
      LIMIT $1
    `, [limit]);

    return result.rows.map((row: { id: string; name: string; sku: string; current_stock: string; low_stock_threshold: string; image_url: string | null }) => ({
      id: row.id,
      name: row.name,
      sku: row.sku,
      stockQuantity: parseInt(row.current_stock),
      minStockLevel: parseInt(row.low_stock_threshold),
      imageUrl: row.image_url,
    }));
  } finally {
    client.release();
  }
}

/**
 * Get recent transactions
 */
export async function getRecentTransactions(limit: number = 10): Promise<RecentTransaction[]> {
  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      SELECT 
        s.id,
        s.invoice_number,
        s.total_amount,
        s.payment_method,
        s.status,
        s.created_at,
        CONCAT(c.first_name, ' ', c.last_name) as customer_name,
        CONCAT(u.first_name, ' ', u.last_name) as cashier_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN users u ON s.user_id = u.id
      ORDER BY s.created_at DESC
      LIMIT $1
    `, [limit]);

    interface TransactionRow {
      id: string;
      invoice_number: string;
      total_amount: string;
      payment_method: string;
      status: string;
      created_at: string;
      customer_name: string | null;
      cashier_name: string | null;
    }

    return result.rows.map((row: TransactionRow) => ({
      id: row.id,
      invoiceNumber: row.invoice_number,
      totalAmount: parseFloat(row.total_amount),
      paymentMethod: row.payment_method,
      customerName: row.customer_name?.trim() || null,
      cashierName: row.cashier_name?.trim() || "Unknown",
      createdAt: row.created_at,
      status: row.status,
    }));
  } finally {
    client.release();
  }
}

/**
 * Get hourly sales distribution for today
 */
export async function getHourlySales(): Promise<HourlySales[]> {
  const client = await pool.connect();
  
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = await client.query(`
      SELECT 
        EXTRACT(HOUR FROM created_at) as hour,
        COALESCE(SUM(total_amount), 0) as sales,
        COUNT(*) as transactions
      FROM sales 
      WHERE created_at >= $1 AND created_at < $2
        AND status = 'completed'
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY hour ASC
    `, [today.toISOString(), tomorrow.toISOString()]);

    interface HourlyRow {
      hour: string;
      sales: string;
      transactions: string;
    }

    // Fill in missing hours with zeros
    const hourlyData: HourlySales[] = [];
    const dataMap = new Map(result.rows.map((r: HourlyRow) => [parseInt(r.hour), r]));
    
    for (let hour = 0; hour < 24; hour++) {
      const data = dataMap.get(hour) as HourlyRow | undefined;
      hourlyData.push({
        hour,
        sales: data ? parseFloat(data.sales) : 0,
        transactions: data ? parseInt(data.transactions) : 0,
      });
    }

    return hourlyData;
  } finally {
    client.release();
  }
}

/**
 * Sales Service
 * Handles POS transactions, payments, and invoices
 */

import { pool } from "../../config/database";
import { NotFoundError, BadRequestError, ForbiddenError } from "../../shared/errors/AppError";
import bcrypt from "bcryptjs";

export interface SaleItem {
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
  discountType?: string;
  discountPercentage?: number;
}

export interface CreateSaleData {
  customerId?: string;
  items: SaleItem[];
  paymentMethod: "cash" | "card" | "gcash" | "maya" | "split";
  amountTendered?: number;
  payments?: { method: string; amount: number; reference?: string }[];
  discountType?: string;
  discountAmount?: number;
  isVatExempt?: boolean;
  vatExemptReason?: string;
  customerIdNumber?: string;
  pointsToRedeem?: number;
  notes?: string;
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  customerId: string | null;
  customerName: string | null;
  userId: string;
  cashierName: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: string;
  amountTendered: number | null;
  changeAmount: number | null;
  status: string;
  pointsEarned: number;
  pointsRedeemed: number;
  isVatExempt: boolean;
  createdAt: string;
  items: SaleItemDetail[];
}

export interface SaleItemDetail {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  subtotal: number;
  totalPrice: number;
}

interface SaleListOptions {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  status?: string;
  paymentMethod?: string;
  customerId?: string;
  userId?: string;
}

/**
 * Create a new sale
 */
export async function create(data: CreateSaleData, userId: string): Promise<Sale> {
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");

    // Calculate totals
    let subtotal = 0;
    let totalDiscount = data.discountAmount || 0;
    let totalTax = 0;
    const itemsData: any[] = [];

    for (const item of data.items) {
      // Get product info
      const productResult = await client.query(
        `SELECT id, name, sku, selling_price, cost_price, current_stock, track_inventory, 
                is_taxable, tax_rate, is_vat_exempt_eligible
         FROM products WHERE id = $1 AND deleted_at IS NULL`,
        [item.productId]
      );

      if (productResult.rows.length === 0) {
        throw new BadRequestError(`Product not found: ${item.productId}`);
      }

      const product = productResult.rows[0];

      // Check stock
      if (product.track_inventory && product.current_stock < item.quantity) {
        throw new BadRequestError(`Insufficient stock for ${product.name}. Available: ${product.current_stock}`);
      }

      const unitPrice = item.unitPrice || parseFloat(product.selling_price);
      const itemSubtotal = unitPrice * item.quantity;
      const itemDiscount = item.discountAmount || 0;
      let itemTax = 0;

      // Calculate tax if applicable
      if (product.is_taxable && !data.isVatExempt) {
        itemTax = (itemSubtotal - itemDiscount) * (parseFloat(product.tax_rate) / 100);
      }

      const itemTotal = itemSubtotal - itemDiscount + itemTax;

      subtotal += itemSubtotal;
      totalTax += itemTax;

      itemsData.push({
        productId: product.id,
        variantId: item.variantId || null,
        productName: product.name,
        productSku: product.sku,
        quantity: item.quantity,
        unitPrice,
        costPrice: parseFloat(product.cost_price),
        discountAmount: itemDiscount,
        discountType: item.discountType || null,
        discountPercentage: item.discountPercentage || null,
        isVatExempt: data.isVatExempt || false,
        taxAmount: itemTax,
        subtotal: itemSubtotal,
        totalPrice: itemTotal,
      });

      // Deduct stock
      if (product.track_inventory) {
        await client.query(
          "UPDATE products SET current_stock = current_stock - $1 WHERE id = $2",
          [item.quantity, product.id]
        );

        // Record stock movement
        await client.query(
          `INSERT INTO stock_movements (product_id, movement_type, quantity, quantity_before, quantity_after, reference_type, created_by)
           VALUES ($1, 'sale', $2, $3, $4, 'sale', $5)`,
          [product.id, -item.quantity, product.current_stock, product.current_stock - item.quantity, userId]
        );
      }
    }

    const totalAmount = subtotal - totalDiscount + totalTax;
    const changeAmount = data.amountTendered ? data.amountTendered - totalAmount : 0;

    // Calculate loyalty points (1 point per 100 pesos)
    let pointsEarned = 0;
    let pointsRedeemed = data.pointsToRedeem || 0;
    let pointsValue = 0;

    if (data.customerId) {
      // Get customer and tier info
      const customerResult = await client.query(
        `SELECT c.loyalty_points, mt.points_multiplier 
         FROM customers c
         LEFT JOIN membership_tiers mt ON c.membership_tier_id = mt.id
         WHERE c.id = $1`,
        [data.customerId]
      );

      if (customerResult.rows.length > 0) {
        const multiplier = parseFloat(customerResult.rows[0].points_multiplier || "1");
        pointsEarned = Math.floor((totalAmount / 100) * multiplier);

        // Handle points redemption
        if (pointsRedeemed > 0) {
          const availablePoints = customerResult.rows[0].loyalty_points;
          if (pointsRedeemed > availablePoints) {
            throw new BadRequestError(`Insufficient points. Available: ${availablePoints}`);
          }
          pointsValue = pointsRedeemed; // 1 point = 1 peso
        }
      }
    }

    // Create sale record
    const saleResult = await client.query(
      `INSERT INTO sales (
        customer_id, user_id, subtotal, discount_amount, tax_amount, total_amount,
        payment_method, amount_tendered, change_amount, discount_type,
        is_vat_exempt, vat_exempt_reason, vatable_amount, vat_amount, vat_exempt_amount,
        points_earned, points_redeemed, points_value_redeemed, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING id, invoice_number`,
      [
        data.customerId || null,
        userId,
        subtotal,
        totalDiscount,
        totalTax,
        totalAmount - pointsValue,
        data.paymentMethod,
        data.amountTendered || null,
        changeAmount > 0 ? changeAmount : null,
        data.discountType || null,
        data.isVatExempt || false,
        data.vatExemptReason || null,
        data.isVatExempt ? 0 : subtotal - totalDiscount,
        totalTax,
        data.isVatExempt ? subtotal - totalDiscount : 0,
        pointsEarned,
        pointsRedeemed,
        pointsValue,
        data.notes || null,
      ]
    );

    const saleId = saleResult.rows[0].id;

    // Insert sale items
    for (const item of itemsData) {
      await client.query(
        `INSERT INTO sale_items (
          sale_id, product_id, variant_id, product_name, product_sku,
          quantity, unit_price, cost_price, discount_amount, discount_type, discount_percentage,
          is_vat_exempt, tax_amount, subtotal, total_price
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          saleId,
          item.productId,
          item.variantId,
          item.productName,
          item.productSku,
          item.quantity,
          item.unitPrice,
          item.costPrice,
          item.discountAmount,
          item.discountType,
          item.discountPercentage,
          item.isVatExempt,
          item.taxAmount,
          item.subtotal,
          item.totalPrice,
        ]
      );
    }

    // Insert payments for split payments
    if (data.paymentMethod === "split" && data.payments) {
      for (const payment of data.payments) {
        await client.query(
          `INSERT INTO sale_payments (sale_id, payment_method, amount, reference_number)
           VALUES ($1, $2, $3, $4)`,
          [saleId, payment.method, payment.amount, payment.reference || null]
        );
      }
    }

    // Record discount for government-mandated
    if (data.isVatExempt && data.vatExemptReason) {
      await client.query(
        `INSERT INTO sale_discounts (sale_id, discount_type, discount_name, discount_amount, is_government_mandated, customer_id_number)
         VALUES ($1, $2, $3, $4, true, $5)`,
        [saleId, data.vatExemptReason, data.vatExemptReason.replace("_", " ").toUpperCase(), totalDiscount, data.customerIdNumber || null]
      );
    }

    // Update customer stats and points
    if (data.customerId) {
      await client.query(
        `UPDATE customers SET 
          loyalty_points = loyalty_points + $1 - $2,
          lifetime_spend = lifetime_spend + $3,
          total_transactions = total_transactions + 1,
          last_transaction_at = NOW()
         WHERE id = $4`,
        [pointsEarned, pointsRedeemed, totalAmount, data.customerId]
      );

      // Record points history
      if (pointsEarned > 0) {
        await client.query(
          `INSERT INTO loyalty_points_history (customer_id, transaction_type, points, balance_after, reference_type, reference_id, description, created_by)
           SELECT $1, 'earn', $2, loyalty_points, 'sale', $3, 'Points earned from purchase', $4
           FROM customers WHERE id = $1`,
          [data.customerId, pointsEarned, saleId, userId]
        );
      }

      if (pointsRedeemed > 0) {
        await client.query(
          `INSERT INTO loyalty_points_history (customer_id, transaction_type, points, balance_after, reference_type, reference_id, description, created_by)
           SELECT $1, 'redeem', $2, loyalty_points, 'sale', $3, 'Points redeemed for purchase', $4
           FROM customers WHERE id = $1`,
          [data.customerId, -pointsRedeemed, saleId, userId]
        );
      }
    }

    await client.query("COMMIT");

    return getById(saleId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get sale by ID
 */
export async function getById(id: string): Promise<Sale> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT s.*, 
        c.first_name || ' ' || c.last_name as customer_name,
        u.first_name || ' ' || u.last_name as cashier_name
       FROM sales s
       LEFT JOIN customers c ON s.customer_id = c.id
       JOIN users u ON s.user_id = u.id
       WHERE s.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError("Sale not found");
    }

    const sale = result.rows[0];

    // Get items
    const itemsResult = await client.query(
      `SELECT * FROM sale_items WHERE sale_id = $1`,
      [id]
    );

    return {
      id: sale.id,
      invoiceNumber: sale.invoice_number,
      customerId: sale.customer_id,
      customerName: sale.customer_name,
      userId: sale.user_id,
      cashierName: sale.cashier_name,
      subtotal: parseFloat(sale.subtotal),
      discountAmount: parseFloat(sale.discount_amount),
      taxAmount: parseFloat(sale.tax_amount),
      totalAmount: parseFloat(sale.total_amount),
      paymentMethod: sale.payment_method,
      amountTendered: sale.amount_tendered ? parseFloat(sale.amount_tendered) : null,
      changeAmount: sale.change_amount ? parseFloat(sale.change_amount) : null,
      status: sale.status,
      pointsEarned: sale.points_earned,
      pointsRedeemed: sale.points_redeemed,
      isVatExempt: sale.is_vat_exempt,
      createdAt: sale.created_at,
      items: itemsResult.rows.map((item: any) => ({
        id: item.id,
        productId: item.product_id,
        productName: item.product_name,
        productSku: item.product_sku,
        quantity: item.quantity,
        unitPrice: parseFloat(item.unit_price),
        discountAmount: parseFloat(item.discount_amount),
        subtotal: parseFloat(item.subtotal),
        totalPrice: parseFloat(item.total_price),
      })),
    };
  } finally {
    client.release();
  }
}

/**
 * Get all sales with filters
 */
export async function getAll(options: SaleListOptions = {}): Promise<{
  sales: Sale[];
  total: number;
  page: number;
  limit: number;
}> {
  const { page = 1, limit = 20, startDate, endDate, status, paymentMethod, customerId, userId } = options;
  const offset = (page - 1) * limit;
  const params: unknown[] = [];
  let paramIndex = 1;

  const conditions: string[] = [];

  if (startDate) {
    conditions.push(`s.created_at >= $${paramIndex++}`);
    params.push(startDate);
  }
  if (endDate) {
    conditions.push(`s.created_at <= $${paramIndex++}`);
    params.push(endDate);
  }
  if (status) {
    conditions.push(`s.status = $${paramIndex++}`);
    params.push(status);
  }
  if (paymentMethod) {
    conditions.push(`s.payment_method = $${paramIndex++}`);
    params.push(paymentMethod);
  }
  if (customerId) {
    conditions.push(`s.customer_id = $${paramIndex++}`);
    params.push(customerId);
  }
  if (userId) {
    conditions.push(`s.user_id = $${paramIndex++}`);
    params.push(userId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const client = await pool.connect();
  try {
    const countResult = await client.query(
      `SELECT COUNT(*) as total FROM sales s ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    const result = await client.query(
      `SELECT s.*, 
        c.first_name || ' ' || c.last_name as customer_name,
        u.first_name || ' ' || u.last_name as cashier_name
       FROM sales s
       LEFT JOIN customers c ON s.customer_id = c.id
       JOIN users u ON s.user_id = u.id
       ${whereClause}
       ORDER BY s.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    const sales = await Promise.all(
      result.rows.map(async (sale: any) => {
        const itemsResult = await client.query(
          `SELECT * FROM sale_items WHERE sale_id = $1`,
          [sale.id]
        );
        return {
          id: sale.id,
          invoiceNumber: sale.invoice_number,
          customerId: sale.customer_id,
          customerName: sale.customer_name,
          userId: sale.user_id,
          cashierName: sale.cashier_name,
          subtotal: parseFloat(sale.subtotal),
          discountAmount: parseFloat(sale.discount_amount),
          taxAmount: parseFloat(sale.tax_amount),
          totalAmount: parseFloat(sale.total_amount),
          paymentMethod: sale.payment_method,
          amountTendered: sale.amount_tendered ? parseFloat(sale.amount_tendered) : null,
          changeAmount: sale.change_amount ? parseFloat(sale.change_amount) : null,
          status: sale.status,
          pointsEarned: sale.points_earned,
          pointsRedeemed: sale.points_redeemed,
          isVatExempt: sale.is_vat_exempt,
          createdAt: sale.created_at,
          items: itemsResult.rows.map((item: any) => ({
            id: item.id,
            productId: item.product_id,
            productName: item.product_name,
            productSku: item.product_sku,
            quantity: item.quantity,
            unitPrice: parseFloat(item.unit_price),
            discountAmount: parseFloat(item.discount_amount),
            subtotal: parseFloat(item.subtotal),
            totalPrice: parseFloat(item.total_price),
          })),
        };
      })
    );

    return { sales, total, page, limit };
  } finally {
    client.release();
  }
}

/**
 * Get today's sales summary
 */
export async function getTodaySummary(userId?: string): Promise<{
  totalSales: number;
  transactionCount: number;
  averageTicket: number;
  cashTotal: number;
  cardTotal: number;
  ewalletTotal: number;
}> {
  const client = await pool.connect();
  try {
    const userCondition = userId ? `AND user_id = '${userId}'` : "";
    
    const result = await client.query(`
      SELECT 
        COALESCE(SUM(total_amount), 0) as total_sales,
        COUNT(*) as transaction_count,
        COALESCE(AVG(total_amount), 0) as average_ticket,
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total_amount ELSE 0 END), 0) as cash_total,
        COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total_amount ELSE 0 END), 0) as card_total,
        COALESCE(SUM(CASE WHEN payment_method IN ('gcash', 'maya') THEN total_amount ELSE 0 END), 0) as ewallet_total
      FROM sales
      WHERE DATE(created_at) = CURRENT_DATE
        AND status = 'completed'
        ${userCondition}
    `);

    const stats = result.rows[0];
    return {
      totalSales: parseFloat(stats.total_sales),
      transactionCount: parseInt(stats.transaction_count),
      averageTicket: parseFloat(stats.average_ticket),
      cashTotal: parseFloat(stats.cash_total),
      cardTotal: parseFloat(stats.card_total),
      ewalletTotal: parseFloat(stats.ewallet_total),
    };
  } finally {
    client.release();
  }
}

/**
 * Void a sale
 */
export async function voidSale(
  saleId: string,
  reason: string,
  supervisorId: string,
  supervisorPin: string,
  voidedBy: string
): Promise<Sale> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Verify supervisor PIN
    const supervisorResult = await client.query(
      `SELECT supervisor_pin_hash, can_authorize_void FROM users WHERE id = $1`,
      [supervisorId]
    );

    if (supervisorResult.rows.length === 0) {
      throw new NotFoundError("Supervisor not found");
    }

    const supervisor = supervisorResult.rows[0];
    if (!supervisor.can_authorize_void) {
      throw new ForbiddenError("User not authorized to approve voids");
    }

    if (!supervisor.supervisor_pin_hash) {
      throw new BadRequestError("Supervisor PIN not set");
    }

    const pinValid = await bcrypt.compare(supervisorPin, supervisor.supervisor_pin_hash);
    if (!pinValid) {
      throw new BadRequestError("Invalid supervisor PIN");
    }

    // Get sale
    const saleResult = await client.query(
      `SELECT * FROM sales WHERE id = $1`,
      [saleId]
    );

    if (saleResult.rows.length === 0) {
      throw new NotFoundError("Sale not found");
    }

    const sale = saleResult.rows[0];
    if (sale.status !== "completed") {
      throw new BadRequestError(`Cannot void a ${sale.status} sale`);
    }

    // Update sale status
    await client.query(
      `UPDATE sales SET 
        status = 'voided', 
        voided_at = NOW(), 
        voided_by = $1, 
        void_authorized_by = $2, 
        void_reason = $3
       WHERE id = $4`,
      [voidedBy, supervisorId, reason, saleId]
    );

    // Restore stock
    const itemsResult = await client.query(
      `SELECT product_id, quantity FROM sale_items WHERE sale_id = $1`,
      [saleId]
    );

    for (const item of itemsResult.rows) {
      await client.query(
        `UPDATE products SET current_stock = current_stock + $1 WHERE id = $2`,
        [item.quantity, item.product_id]
      );

      // Record stock movement
      const stockResult = await client.query(
        `SELECT current_stock FROM products WHERE id = $1`,
        [item.product_id]
      );
      
      await client.query(
        `INSERT INTO stock_movements (product_id, movement_type, quantity, quantity_before, quantity_after, reference_type, reference_id, notes, created_by)
         VALUES ($1, 'return', $2, $3, $4, 'void', $5, $6, $7)`,
        [item.product_id, item.quantity, stockResult.rows[0].current_stock - item.quantity, stockResult.rows[0].current_stock, saleId, `Void: ${reason}`, voidedBy]
      );
    }

    // Reverse customer points
    if (sale.customer_id) {
      await client.query(
        `UPDATE customers SET 
          loyalty_points = loyalty_points - $1 + $2,
          lifetime_spend = lifetime_spend - $3,
          total_transactions = total_transactions - 1
         WHERE id = $4`,
        [sale.points_earned, sale.points_redeemed, parseFloat(sale.total_amount), sale.customer_id]
      );
    }

    await client.query("COMMIT");
    return getById(saleId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Void a sale - Self authorized (for super_admin/manager)
 */
export async function voidSaleSelfAuthorized(
  saleId: string,
  reason: string,
  voidedBy: string
): Promise<Sale> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Get sale
    const saleResult = await client.query(
      `SELECT * FROM sales WHERE id = $1`,
      [saleId]
    );

    if (saleResult.rows.length === 0) {
      throw new NotFoundError("Sale not found");
    }

    const sale = saleResult.rows[0];
    if (sale.status !== "completed") {
      throw new BadRequestError(`Cannot void a ${sale.status} sale`);
    }

    // Update sale status - self-authorized
    await client.query(
      `UPDATE sales SET 
        status = 'voided', 
        voided_at = NOW(), 
        voided_by = $1, 
        void_authorized_by = $1, 
        void_reason = $2
       WHERE id = $3`,
      [voidedBy, reason, saleId]
    );

    // Restore stock
    const itemsResult = await client.query(
      `SELECT product_id, quantity FROM sale_items WHERE sale_id = $1`,
      [saleId]
    );

    for (const item of itemsResult.rows) {
      await client.query(
        `UPDATE products SET current_stock = current_stock + $1 WHERE id = $2`,
        [item.quantity, item.product_id]
      );

      // Record stock movement
      const stockResult = await client.query(
        `SELECT current_stock FROM products WHERE id = $1`,
        [item.product_id]
      );
      
      await client.query(
        `INSERT INTO stock_movements (product_id, movement_type, quantity, quantity_before, quantity_after, reference_type, reference_id, notes, created_by)
         VALUES ($1, 'return', $2, $3, $4, 'void', $5, $6, $7)`,
        [item.product_id, item.quantity, stockResult.rows[0].current_stock - item.quantity, stockResult.rows[0].current_stock, saleId, `Void: ${reason}`, voidedBy]
      );
    }

    // Reverse customer points
    if (sale.customer_id) {
      await client.query(
        `UPDATE customers SET 
          loyalty_points = loyalty_points - $1 + $2,
          lifetime_spend = lifetime_spend - $3,
          total_transactions = total_transactions - 1
         WHERE id = $4`,
        [sale.points_earned, sale.points_redeemed, parseFloat(sale.total_amount), sale.customer_id]
      );
    }

    await client.query("COMMIT");
    return getById(saleId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Refund a sale
 */
export async function refundSale(
  saleId: string,
  reason: string,
  supervisorId: string,
  supervisorPin: string,
  refundedBy: string
): Promise<Sale> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Verify supervisor PIN
    const supervisorResult = await client.query(
      `SELECT supervisor_pin_hash, can_authorize_refund FROM users WHERE id = $1`,
      [supervisorId]
    );

    if (supervisorResult.rows.length === 0) {
      throw new NotFoundError("Supervisor not found");
    }

    const supervisor = supervisorResult.rows[0];
    if (!supervisor.can_authorize_refund) {
      throw new ForbiddenError("User not authorized to approve refunds");
    }

    if (!supervisor.supervisor_pin_hash) {
      throw new BadRequestError("Supervisor PIN not set");
    }

    const pinValid = await bcrypt.compare(supervisorPin, supervisor.supervisor_pin_hash);
    if (!pinValid) {
      throw new BadRequestError("Invalid supervisor PIN");
    }

    // Get sale
    const saleResult = await client.query(
      `SELECT * FROM sales WHERE id = $1`,
      [saleId]
    );

    if (saleResult.rows.length === 0) {
      throw new NotFoundError("Sale not found");
    }

    const sale = saleResult.rows[0];
    if (sale.status !== "completed") {
      throw new BadRequestError(`Cannot refund a ${sale.status} sale`);
    }

    // Update sale status
    await client.query(
      `UPDATE sales SET 
        status = 'refunded', 
        refunded_at = NOW(), 
        refunded_by = $1, 
        refund_authorized_by = $2, 
        refund_reason = $3,
        refund_amount = total_amount
       WHERE id = $4`,
      [refundedBy, supervisorId, reason, saleId]
    );

    // Restore stock
    const itemsResult = await client.query(
      `SELECT product_id, quantity FROM sale_items WHERE sale_id = $1`,
      [saleId]
    );

    for (const item of itemsResult.rows) {
      await client.query(
        `UPDATE products SET current_stock = current_stock + $1 WHERE id = $2`,
        [item.quantity, item.product_id]
      );

      // Record stock movement
      const stockResult = await client.query(
        `SELECT current_stock FROM products WHERE id = $1`,
        [item.product_id]
      );
      
      await client.query(
        `INSERT INTO stock_movements (product_id, movement_type, quantity, quantity_before, quantity_after, reference_type, reference_id, notes, created_by)
         VALUES ($1, 'return', $2, $3, $4, 'refund', $5, $6, $7)`,
        [item.product_id, item.quantity, stockResult.rows[0].current_stock - item.quantity, stockResult.rows[0].current_stock, saleId, `Refund: ${reason}`, refundedBy]
      );
    }

    // Reverse customer points
    if (sale.customer_id) {
      await client.query(
        `UPDATE customers SET 
          loyalty_points = loyalty_points - $1 + $2,
          lifetime_spend = lifetime_spend - $3,
          total_transactions = total_transactions - 1
         WHERE id = $4`,
        [sale.points_earned, sale.points_redeemed, parseFloat(sale.total_amount), sale.customer_id]
      );
    }

    await client.query("COMMIT");
    return getById(saleId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Refund a sale - Self authorized (for super_admin/manager)
 */
export async function refundSaleSelfAuthorized(
  saleId: string,
  reason: string,
  refundedBy: string
): Promise<Sale> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Get sale
    const saleResult = await client.query(
      `SELECT * FROM sales WHERE id = $1`,
      [saleId]
    );

    if (saleResult.rows.length === 0) {
      throw new NotFoundError("Sale not found");
    }

    const sale = saleResult.rows[0];
    if (sale.status !== "completed") {
      throw new BadRequestError(`Cannot refund a ${sale.status} sale`);
    }

    // Update sale status - self-authorized
    await client.query(
      `UPDATE sales SET 
        status = 'refunded', 
        refunded_at = NOW(), 
        refunded_by = $1, 
        refund_authorized_by = $1, 
        refund_reason = $2,
        refund_amount = total_amount
       WHERE id = $3`,
      [refundedBy, reason, saleId]
    );

    // Restore stock
    const itemsResult = await client.query(
      `SELECT product_id, quantity FROM sale_items WHERE sale_id = $1`,
      [saleId]
    );

    for (const item of itemsResult.rows) {
      await client.query(
        `UPDATE products SET current_stock = current_stock + $1 WHERE id = $2`,
        [item.quantity, item.product_id]
      );

      // Record stock movement
      const stockResult = await client.query(
        `SELECT current_stock FROM products WHERE id = $1`,
        [item.product_id]
      );
      
      await client.query(
        `INSERT INTO stock_movements (product_id, movement_type, quantity, quantity_before, quantity_after, reference_type, reference_id, notes, created_by)
         VALUES ($1, 'return', $2, $3, $4, 'refund', $5, $6, $7)`,
        [item.product_id, item.quantity, stockResult.rows[0].current_stock - item.quantity, stockResult.rows[0].current_stock, saleId, `Refund: ${reason}`, refundedBy]
      );
    }

    // Reverse customer points
    if (sale.customer_id) {
      await client.query(
        `UPDATE customers SET 
          loyalty_points = loyalty_points - $1 + $2,
          lifetime_spend = lifetime_spend - $3,
          total_transactions = total_transactions - 1
         WHERE id = $4`,
        [sale.points_earned, sale.points_redeemed, parseFloat(sale.total_amount), sale.customer_id]
      );
    }

    await client.query("COMMIT");
    return getById(saleId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

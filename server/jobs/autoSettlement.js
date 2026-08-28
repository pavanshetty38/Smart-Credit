import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Repayment from '../models/Repayment.js';
import Settlement from '../models/Settlement.js';
import { ref, notifyUser } from '../utils.js';

let lastRunKey = '';

/**
 * Get current hour in the configured timezone (default Asia/Kolkata for IST 8:00 AM)
 */
function getCurrentTzHour(date) {
  const tz = process.env.TIMEZONE || 'Asia/Kolkata';
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false,
    });
    return Number(formatter.format(date));
  } catch (e) {
    return date.getHours();
  }
}

/**
 * Settle outstanding transactions for a specific customer
 */
export async function runAutoSettlementForCustomer(customerId, force = false) {
  const customer = await User.findById(customerId);
  if (!customer || customer.role !== 'customer') {
    throw new Error('Customer not found');
  }

  // Find all approved unpaid transactions
  const txs = await Transaction.find({
    customer: customer._id,
    status: 'approved',
  }).sort('createdAt');

  let totalOutstanding = 0;
  for (const tx of txs) {
    const rem = Math.max(0, (Number(tx.amount) || 0) - (Number(tx.paidAmount) || 0));
    totalOutstanding += rem;
  }

  if (totalOutstanding <= 0) {
    return {
      settled: false,
      message: 'No outstanding dues to settle',
      settledAmount: 0,
      transactionsCount: 0,
    };
  }

  const now = new Date();
  const method = customer.autoSettlementMethod || 'SIMULATED_AUTO_DEBIT';

  // 1. Create Repayment record
  const repayment = await Repayment.create({
    reference: ref('AUTO'),
    customer: customer._id,
    amount: totalOutstanding,
    method: method,
  });

  // 2. Create Settlement record
  const settlement = await Settlement.create({
    reference: ref('SET'),
    customer: customer._id,
    amount: totalOutstanding,
    method: method,
    type: 'auto',
    status: 'completed',
    createdAt: now,
  });

  // 3. Mark transactions as paid & settled
  for (const tx of txs) {
    tx.paidAmount = tx.amount;
    tx.status = 'paid';
    tx.settlementStatus = 'settled';
    tx.settledAt = now;
    await tx.save();
  }

  // 4. Send notification to Customer
  try {
    await notifyUser(
      customer,
      'Auto Settlement completed',
      `Your outstanding credit of ₹${totalOutstanding.toLocaleString('en-IN')} was automatically settled via ${method.replace('SIMULATED_', '')} at 08:00 AM.`,
      'settlement',
      {
        amount: totalOutstanding,
        method: method,
        settlementId: settlement._id,
        repaymentId: repayment._id,
      }
    );
  } catch (err) {
    console.error('Customer auto settlement notification error:', err);
  }

  // 5. Send notification to Merchants
  try {
    const merchantIds = [...new Set(txs.map((tx) => String(tx.merchant)))];
    await Promise.all(
      merchantIds.map(async (merchantId) => {
        const merchantAmount = txs
          .filter((tx) => String(tx.merchant) === merchantId)
          .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

        return notifyUser(
          merchantId,
          'Credit Sales Settled',
          `Auto settlement completed for ₹${merchantAmount.toLocaleString('en-IN')} of credit sales from ${customer.name}.`,
          'settlement',
          {
            amount: merchantAmount,
            customerId: customer._id,
          }
        );
      })
    );
  } catch (err) {
    console.error('Merchant auto settlement notification error:', err);
  }

  console.log(`[AutoSettlement] Settled ₹${totalOutstanding.toFixed(2)} for customer: ${customer.email}`);

  return {
    settled: true,
    settledAmount: totalOutstanding,
    transactionsCount: txs.length,
    settlement,
    repayment,
  };
}

/**
 * Main auto settlement runner executed by the scheduler
 */
export async function runAutoSettlement(force = false) {
  const now = new Date();
  const runKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  const targetHour = Number(process.env.AUTO_SETTLEMENT_HOUR || 8);
  const tzHour = getCurrentTzHour(now);
  const localHour = now.getHours();

  // Match target hour either in configured timezone (IST) or server local time
  const isTargetHour = tzHour === targetHour || localHour === targetHour;

  if (!force && (!isTargetHour || lastRunKey === runKey)) {
    return { processed: 0, reason: !isTargetHour ? 'Not target hour' : 'Already ran today' };
  }

  lastRunKey = runKey;
  console.log(`[AutoSettlement] Starting daily auto settlement job at ${targetHour}:00 AM (Date: ${runKey})...`);

  const customers = await User.find({
    role: 'customer',
    autoSettlementEnabled: true,
    kycStatus: 'approved',
  });

  let processed = 0;
  let totalAmountSettled = 0;

  for (const customer of customers) {
    try {
      const result = await runAutoSettlementForCustomer(customer._id, force);
      if (result.settled) {
        processed += 1;
        totalAmountSettled += result.settledAmount;
      }
    } catch (e) {
      console.error(`[AutoSettlement] Error settling customer ${customer.email}:`, e);
    }
  }

  console.log(`[AutoSettlement] Completed. ${processed} customer(s) settled for total ₹${totalAmountSettled.toFixed(2)}`);
  return { processed, totalAmountSettled };
}

/**
 * Starts the interval timer scheduler running every 60s
 */
export function startAutoSettlementScheduler() {
  const tick = async () => {
    try {
      await runAutoSettlement(false);
    } catch (e) {
      console.error('[AutoSettlement] Scheduler tick error:', e);
    }
  };

  // Run initial tick on boot
  tick();

  // Tick every 60 seconds
  setInterval(tick, 60 * 1000);
  console.log(`[AutoSettlement] Daily scheduler active. Auto-settles every morning at ${process.env.AUTO_SETTLEMENT_HOUR || 8}:00 AM.`);
}

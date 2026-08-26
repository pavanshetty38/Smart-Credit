import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Repayment from '../models/Repayment.js';
import Settlement from '../models/Settlement.js';
import { ref, notifyUser } from '../utils.js';

let lastRunKey = '';

export async function runAutoSettlement(force = false) {
  const now = new Date();
  const runKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  const hour = Number(process.env.AUTO_SETTLEMENT_HOUR || 8);
  if (!force && (now.getHours() !== hour || lastRunKey === runKey)) return { processed: 0 };
  lastRunKey = runKey;

  const customers = await User.find({ role: 'customer', autoSettlementEnabled: true, kycStatus: 'approved' });
  let processed = 0;
  for (const customer of customers) {
    const txs = await Transaction.find({ customer: customer._id, status: 'approved' }).sort('createdAt');
    const outstanding = txs.reduce((sum, tx) => sum + tx.amount, 0);
    if (!outstanding) continue;

    await Repayment.create({ reference: ref('AUTO'), customer: customer._id, amount: outstanding, method: customer.autoSettlementMethod || 'SIMULATED_UPI' });
    await Settlement.create({ reference: ref('SET'), customer: customer._id, amount: outstanding, method: customer.autoSettlementMethod || 'SIMULATED_UPI', type: 'auto', status: 'completed' });
    await Transaction.updateMany({ customer: customer._id, status: 'approved' }, { $set: { status: 'paid', settlementStatus: 'settled', settledAt: now } });

    await notifyUser(
      customer,
      'Auto Settlement completed',
      `Your outstanding credit of ₹${outstanding.toLocaleString('en-IN')} was automatically settled.`,
      'settlement',
      { amount: outstanding, method: customer.autoSettlementMethod || 'SIMULATED_UPI' }
    );

    const merchantIds = [...new Set(txs.map(tx => String(tx.merchant)))];
    await Promise.all(
      merchantIds.map(async merchantId => {
        const merchantAmount = txs
          .filter(tx => String(tx.merchant) === merchantId)
          .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

        return notifyUser(
          merchantId,
          'Settlement completed',
          `Auto settlement completed for ₹${merchantAmount.toLocaleString('en-IN')} of your credit sales.`,
          'settlement',
          { amount: merchantAmount }
        );
      })
    );

    processed += 1;
    console.log(`Auto-settled ₹${outstanding.toFixed(2)} for ${customer.email}`);
  }
  return { processed };
}

export function startAutoSettlementScheduler() {
  const tick = async () => {
    try { await runAutoSettlement(false); } catch (e) { console.error('Auto settlement error:', e); }
  };
  tick();
  setInterval(tick, 60 * 1000);
  console.log(`Auto Settlement scheduler active at ${process.env.AUTO_SETTLEMENT_HOUR || 8}:00 server time`);
}

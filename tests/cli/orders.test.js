import { describe, expect, it } from 'vitest';

import { orders } from '../../src/cli/commands/orders.js';
import {
  STALE_AFTER_DAYS,
  historyOver,
  ordersReport,
  renderOrders,
} from '../../src/report/orders.js';
import { loadCase } from '../../src/cli/context.js';
import { FOUND, OK, REFUSED } from '../../src/cli/output.js';
import { parseInstant } from '../../src/time/instant.js';
import { CASE, base, recorder } from '../support/cli.js';

const loaded = loadCase(CASE);
const at = (text) => parseInstant(text, { zone: 'eastern' });

describe('the orders report', () => {
  const report = ordersReport({ orders: loaded.orders, at: at('2025-09-05 09:00') });

  it('lists every order, newest first', () => {
    expect(report.rows.map((one) => one.number)).toEqual(['EO-2025-05', 'EO-2025-04']);
  });

  it('counts the ones in force at the moment asked about', () => {
    expect(report.inForce).toBe(1);
  });

  it('reads an order as lifted once its lifting time has passed', () => {
    expect(report.rows.find((one) => one.number === 'EO-2025-04').state).toBe('lifted');
  });

  it('reads the same order as in force earlier', () => {
    const earlier = ordersReport({ orders: loaded.orders, at: at('2025-08-20 09:00') });
    expect(earlier.rows.find((one) => one.number === 'EO-2025-04').state).toBe('in force');
  });

  it('narrows to one area when asked', () => {
    const one = ordersReport({ orders: loaded.orders, at: at('2025-09-05 09:00'), areaId: 'C-3' });
    expect(one.rows.map((one_) => one_.number)).toEqual(['EO-2025-04']);
  });

  it('has nothing to say about an area no order covers', () => {
    const none = ordersReport({
      orders: loaded.orders,
      at: at('2025-09-05 09:00'),
      areaId: 'B-12',
    });
    expect(none.rows).toEqual([]);
    expect(renderOrders(none)).toContain('No order has ever been signed over this water.');
  });

  it('gives a clearance answer for a biotoxin order and a dash for the rest', () => {
    expect(report.rows.find((one) => one.number === 'EO-2025-04').clearance).not.toBe('-');
    expect(report.rows.find((one) => one.number === 'EO-2025-05').clearance).toBe('-');
  });

  it('warns when an order in force has its clearance samples', () => {
    const during = ordersReport({
      orders: loaded.orders,
      at: at('2025-08-20 09:00'),
      samples: [
        { at: at('2025-08-18 09:00'), conforming: true },
        { at: at('2025-08-19 09:00'), conforming: true },
      ],
    });
    expect(during.problems.has('order.clearanceMet')).toBe(true);
  });

  it('lists the orders over an area oldest first for a history', () => {
    expect(historyOver(loaded.orders, 'C-3').map((one) => one.number)).toEqual(['EO-2025-04']);
  });
});

describe('the rendered report', () => {
  const text = renderOrders(ordersReport({ orders: loaded.orders, at: at('2025-09-05 09:00') }));

  it('counts the orders and the ones in force', () => {
    expect(text).toMatch(/Orders:\s+2/);
    expect(text).toMatch(/In force: 1/);
  });

  it('prints a clearance section for the biotoxin order only', () => {
    expect(text).toContain('Clearance');
    expect(text).toContain('Karenia bloom offshore');
    expect(text).not.toContain('fuel spill');
  });

  it('is the same text twice', () => {
    expect(renderOrders(ordersReport({ orders: loaded.orders, at: at('2025-09-05 09:00') }))).toBe(
      text,
    );
  });
});

describe('the orders command', () => {
  it('prints the register and exits with a finding while one is in force', () => {
    const io = recorder();
    expect(orders(base({ at: '2025-09-05 09:00' }), io)).toBe(FOUND);
    expect(io.out).toContain('EO-2025-05');
  });

  it('exits clean once every order has lifted', () => {
    const io = recorder();
    expect(orders(base({ at: '2025-08-30 09:00', area: 'C-3' }), io)).toBe(OK);
  });

  it('narrows to one area', () => {
    const io = recorder();
    orders(base({ at: '2025-09-05 09:00', area: 'C-3' }), io);
    expect(io.out).toContain('Emergency orders over C-3');
    expect(io.out).not.toContain('EO-2025-05');
  });

  it('prints the register as JSON when asked', () => {
    const io = recorder();
    orders(base({ at: '2025-09-05 09:00', json: true }), io);
    const answer = JSON.parse(io.out);
    expect(answer.inForce).toBe(1);
    expect(answer.orders[0].number).toBe('EO-2025-05');
  });

  it('refuses an area that is not in the register', () => {
    const io = recorder();
    expect(orders(base({ at: '2025-09-05 09:00', area: 'Z-9' }), io)).toBe(REFUSED);
  });
});

describe('an order that has stood a long time', () => {
  it('is warned about once it passes the interval', () => {
    const fresh = ordersReport({ orders: loaded.orders, at: at('2025-09-05 09:00') });
    const stale = ordersReport({ orders: loaded.orders, at: at('2026-01-05 09:00') });
    expect(fresh.problems.has('order.stale')).toBe(false);
    expect(stale.problems.has('order.stale')).toBe(true);
    expect(STALE_AFTER_DAYS).toBe(90);
  });

  it('counts the days it has stood on the row', () => {
    const stale = ordersReport({ orders: loaded.orders, at: at('2026-01-05 09:00') });
    const row = stale.rows.find((one) => one.number === 'EO-2025-05');
    expect(row.standingDays).toBeGreaterThan(90);
  });

  it('says nothing about an order that has already been lifted', () => {
    const stale = ordersReport({ orders: loaded.orders, at: at('2026-01-05 09:00') });
    const lifted = stale.rows.find((one) => one.number === 'EO-2025-04');
    expect(lifted.standingDays).toBe(0);
  });
});

import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createTicketingServer } from '../src/server.js';

async function startTestServer(options) {
  const server = createTicketingServer(options);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    server,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
  };
}

async function requestJson(baseUrl, path, { method = 'GET', userId, body, rawBody } = {}) {
  const headers = {};
  if (userId) headers['x-user-id'] = userId;
  if (body !== undefined || rawBody !== undefined) headers['content-type'] = 'application/json';

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: rawBody ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const payload = await response.json();
  return { status: response.status, payload };
}

describe('REST API (in-memory)', () => {
  let server;
  let baseUrl;

  beforeEach(async () => {
    ({ server, baseUrl } = await startTestServer());
  });

  afterEach(async () => {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  });

  async function createPublishedEvent({
    organizerId = 'org-1',
    title = 'Lagos Tech Meetup',
    city = 'Lagos',
    venue = 'Landmark Centre',
    startsAt = '2026-12-05T17:00:00Z',
    tierName = 'General',
    priceCents = 500000,
    capacity = 10,
  } = {}) {
    const created = await requestJson(baseUrl, '/api/events', {
      method: 'POST',
      userId: organizerId,
      body: { title, city, venue, startsAt },
    });
    assert.equal(created.status, 201);
    const event = created.payload.event;

    const tiered = await requestJson(baseUrl, `/api/events/${event.id}/tiers`, {
      method: 'POST',
      userId: organizerId,
      body: { name: tierName, priceCents, capacity },
    });
    assert.equal(tiered.status, 201);

    const published = await requestJson(baseUrl, `/api/events/${event.id}/publish`, {
      method: 'POST',
      userId: organizerId,
    });
    assert.equal(published.status, 200);

    return { event: published.payload.event, tier: tiered.payload.tier };
  }

  describe('S02 create an event', () => {
    it('creates a draft event that is hidden from the public list', async () => {
      const { status, payload } = await requestJson(baseUrl, '/api/events', {
        method: 'POST',
        userId: 'org-1',
        body: {
          title: 'Abuja Jazz Night',
          city: 'Abuja',
          venue: 'Transcorp',
          startsAt: '2026-12-10T18:00:00Z',
        },
      });
      assert.equal(status, 201);
      assert.equal(payload.event.status, 'draft');
      assert.ok(payload.event.id);

      const list = await requestJson(baseUrl, '/api/events');
      assert.equal(list.status, 200);
      assert.equal(list.payload.events.length, 0);
    });

    it('rejects missing title, missing city, or invalid date with VALIDATION', async () => {
      for (const badBody of [
        { city: 'Lagos', startsAt: '2026-12-05T17:00:00Z' },
        { title: 'Show', startsAt: '2026-12-05T17:00:00Z' },
        { title: 'Show', city: 'Lagos', startsAt: 'not-a-date' },
      ]) {
        const res = await requestJson(baseUrl, '/api/events', {
          method: 'POST',
          userId: 'org-1',
          body: badBody,
        });
        assert.equal(res.status, 400);
        assert.equal(res.payload.error.code, 'VALIDATION');
      }
    });

    it('requires x-user-id header and rejects non-object JSON bodies', async () => {
      const noAuth = await requestJson(baseUrl, '/api/events', {
        method: 'POST',
        body: { title: 'Show', city: 'Lagos', startsAt: '2026-12-05T17:00:00Z' },
      });
      assert.equal(noAuth.status, 401);
      assert.equal(noAuth.payload.error.code, 'UNAUTHENTICATED');

      const arrayBody = await requestJson(baseUrl, '/api/events', {
        method: 'POST',
        userId: 'org-1',
        rawBody: '[]',
      });
      assert.equal(arrayBody.status, 400);
      assert.equal(arrayBody.payload.error.code, 'VALIDATION');
    });
  });

  describe('S03 add ticket tiers', () => {
    it('adds a tier with 0 sold and rejects invalid numbers or non-organizers', async () => {
      const created = await requestJson(baseUrl, '/api/events', {
        method: 'POST',
        userId: 'org-1',
        body: { title: 'Show', city: 'Lagos', startsAt: '2026-12-05T17:00:00Z' },
      });
      const eventId = created.payload.event.id;

      const ok = await requestJson(baseUrl, `/api/events/${eventId}/tiers`, {
        method: 'POST',
        userId: 'org-1',
        body: { name: 'VIP', priceCents: 100000, capacity: 25 },
      });
      assert.equal(ok.status, 201);
      assert.equal(ok.payload.tier.sold, 0);
      assert.equal(ok.payload.tier.capacity, 25);

      const badPrice = await requestJson(baseUrl, `/api/events/${eventId}/tiers`, {
        method: 'POST',
        userId: 'org-1',
        body: { name: 'Bad', priceCents: 12.5, capacity: 10 },
      });
      assert.equal(badPrice.status, 400);
      assert.equal(badPrice.payload.error.code, 'VALIDATION');

      const forbidden = await requestJson(baseUrl, `/api/events/${eventId}/tiers`, {
        method: 'POST',
        userId: 'org-2',
        body: { name: 'Other', priceCents: 1000, capacity: 10 },
      });
      assert.equal(forbidden.status, 403);
      assert.equal(forbidden.payload.error.code, 'FORBIDDEN');

      const missing = await requestJson(baseUrl, '/api/events/missing-id/tiers', {
        method: 'POST',
        userId: 'org-1',
        body: { name: 'VIP', priceCents: 1000, capacity: 10 },
      });
      assert.equal(missing.status, 404);
      assert.equal(missing.payload.error.code, 'NOT_FOUND');
    });
  });

  describe('S04 publish and unpublish', () => {
    it('publishes and unpublishes an event, and rejects publishing with no tiers', async () => {
      const created = await requestJson(baseUrl, '/api/events', {
        method: 'POST',
        userId: 'org-1',
        body: { title: 'Draft Event', city: 'Lagos', startsAt: '2026-12-05T17:00:00Z' },
      });
      const eventId = created.payload.event.id;

      const noTiers = await requestJson(baseUrl, `/api/events/${eventId}/publish`, {
        method: 'POST',
        userId: 'org-1',
      });
      assert.equal(noTiers.status, 409);
      assert.equal(noTiers.payload.error.code, 'INVALID_STATE');

      await requestJson(baseUrl, `/api/events/${eventId}/tiers`, {
        method: 'POST',
        userId: 'org-1',
        body: { name: 'General', priceCents: 5000, capacity: 10 },
      });

      const pub = await requestJson(baseUrl, `/api/events/${eventId}/publish`, {
        method: 'POST',
        userId: 'org-1',
      });
      assert.equal(pub.status, 200);
      assert.equal(pub.payload.event.status, 'published');

      const unpub = await requestJson(baseUrl, `/api/events/${eventId}/unpublish`, {
        method: 'POST',
        userId: 'org-1',
      });
      assert.equal(unpub.status, 200);
      assert.equal(unpub.payload.event.status, 'draft');

      const hidden = await requestJson(baseUrl, `/api/events/${eventId}`);
      assert.equal(hidden.status, 404);
    });
  });

  describe('S05 search, filter, and sort', () => {
    it('filters by q, city, maxPriceCents, and date range, and rejects bad query params', async () => {
      await createPublishedEvent({
        title: 'Lagos Tech Meetup',
        city: 'Lagos',
        startsAt: '2026-12-05T17:00:00Z',
        priceCents: 5000,
      });
      await createPublishedEvent({
        title: 'Abuja Jazz Night',
        city: 'Abuja',
        startsAt: '2026-12-06T19:00:00Z',
        priceCents: 2000,
      });

      const byText = await requestJson(baseUrl, '/api/events?q=JAZZ');
      assert.equal(byText.status, 200);
      assert.deepEqual(
        byText.payload.events.map((e) => e.title),
        ['Abuja Jazz Night'],
      );

      const byPrice = await requestJson(baseUrl, '/api/events?maxPriceCents=5000&sort=price');
      assert.equal(byPrice.status, 200);
      assert.deepEqual(
        byPrice.payload.events.map((e) => e.title),
        ['Abuja Jazz Night', 'Lagos Tech Meetup'],
      );

      const badSort = await requestJson(baseUrl, '/api/events?sort=random');
      assert.equal(badSort.status, 400);
      assert.equal(badSort.payload.error.code, 'VALIDATION');

      const badPrice = await requestJson(baseUrl, '/api/events?maxPriceCents=12.5');
      assert.equal(badPrice.status, 400);
      assert.equal(badPrice.payload.error.code, 'VALIDATION');
    });
  });

  describe('S06 book tickets', () => {
    it('creates a pending booking priced in whole cents and rejects overselling with SOLD_OUT', async () => {
      const { event, tier } = await createPublishedEvent({ priceCents: 2500, capacity: 3 });

      const booked = await requestJson(baseUrl, '/api/bookings', {
        method: 'POST',
        userId: 'user-1',
        body: { tierId: tier.id, quantity: 2 },
      });
      assert.equal(booked.status, 201);
      assert.equal(booked.payload.booking.status, 'pending');
      assert.equal(booked.payload.booking.amountCents, 5000);
      assert.ok(booked.payload.booking.reference);

      const soldOut = await requestJson(baseUrl, '/api/bookings', {
        method: 'POST',
        userId: 'user-2',
        body: { tierId: tier.id, quantity: 2 },
      });
      assert.equal(soldOut.status, 409);
      assert.equal(soldOut.payload.error.code, 'SOLD_OUT');

      const details = await requestJson(baseUrl, `/api/events/${event.id}`);
      assert.equal(details.payload.event.tiers[0].sold, 2);
    });
  });

  describe('S07 pay for a booking and cancel unpaid booking', () => {
    it('pays with a valid token, keeps pending on decline, and allows retry', async () => {
      const { tier } = await createPublishedEvent({ priceCents: 4000, capacity: 5 });
      const booked = await requestJson(baseUrl, '/api/bookings', {
        method: 'POST',
        userId: 'user-1',
        body: { tierId: tier.id, quantity: 2 },
      });
      const ref = booked.payload.booking.reference;

      const declined = await requestJson(baseUrl, `/api/bookings/${ref}/pay`, {
        method: 'POST',
        userId: 'user-1',
        body: { paymentToken: 'tok_decline' },
      });
      assert.equal(declined.status, 402);
      assert.equal(declined.payload.error.code, 'PAYMENT_DECLINED');

      const stillPending = await requestJson(baseUrl, `/api/bookings/${ref}`, {
        userId: 'user-1',
      });
      assert.equal(stillPending.payload.booking.status, 'pending');

      const paid = await requestJson(baseUrl, `/api/bookings/${ref}/pay`, {
        method: 'POST',
        userId: 'user-1',
        body: { paymentToken: 'tok_valid' },
      });
      assert.equal(paid.status, 200);
      assert.equal(paid.payload.booking.status, 'paid');

      const payTwice = await requestJson(baseUrl, `/api/bookings/${ref}/pay`, {
        method: 'POST',
        userId: 'user-1',
        body: { paymentToken: 'tok_valid' },
      });
      assert.equal(payTwice.status, 409);
      assert.equal(payTwice.payload.error.code, 'INVALID_TRANSITION');
    });

    it('forbids paying someone else’s booking and rejects paying a cancelled booking', async () => {
      const { event, tier } = await createPublishedEvent({ priceCents: 4000, capacity: 2 });
      const booked = await requestJson(baseUrl, '/api/bookings', {
        method: 'POST',
        userId: 'user-1',
        body: { tierId: tier.id, quantity: 2 },
      });
      const ref = booked.payload.booking.reference;

      const forbidden = await requestJson(baseUrl, `/api/bookings/${ref}/pay`, {
        method: 'POST',
        userId: 'user-2',
        body: { paymentToken: 'tok_valid' },
      });
      assert.equal(forbidden.status, 403);
      assert.equal(forbidden.payload.error.code, 'FORBIDDEN');

      const cancelled = await requestJson(baseUrl, `/api/bookings/${ref}/cancel`, {
        method: 'POST',
        userId: 'user-1',
      });
      assert.equal(cancelled.status, 200);
      assert.equal(cancelled.payload.booking.status, 'cancelled');

      const eventAfter = await requestJson(baseUrl, `/api/events/${event.id}`);
      assert.equal(eventAfter.payload.event.tiers[0].sold, 0);

      const payCancelled = await requestJson(baseUrl, `/api/bookings/${ref}/pay`, {
        method: 'POST',
        userId: 'user-1',
        body: { paymentToken: 'tok_valid' },
      });
      assert.equal(payCancelled.status, 409);
      assert.equal(payCancelled.payload.error.code, 'INVALID_TRANSITION');
    });

    it('refuses to cancel a paid booking', async () => {
      const { tier } = await createPublishedEvent({ priceCents: 4000, capacity: 2 });
      const booked = await requestJson(baseUrl, '/api/bookings', {
        method: 'POST',
        userId: 'user-1',
        body: { tierId: tier.id, quantity: 1 },
      });
      const ref = booked.payload.booking.reference;

      await requestJson(baseUrl, `/api/bookings/${ref}/pay`, {
        method: 'POST',
        userId: 'user-1',
        body: { paymentToken: 'tok_valid' },
      });

      const cancelPaid = await requestJson(baseUrl, `/api/bookings/${ref}/cancel`, {
        method: 'POST',
        userId: 'user-1',
      });
      assert.equal(cancelPaid.status, 409);
      assert.equal(cancelPaid.payload.error.code, 'INVALID_STATE');
    });
  });
});

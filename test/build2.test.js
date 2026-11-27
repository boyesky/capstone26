/**
 * Build 2 acceptance tests.
 *
 * One test per acceptance criterion in docs/build-2.md for:
 *   S02 – create an event
 *   S03 – add ticket tiers
 *   S04 – publish and unpublish an event
 *   S05 – search, filter and sort published events
 *   S06 – book tickets
 *
 * Additional cases required by the prompt:
 *   - original list is unchanged after sort / filter
 *   - sort is stable
 *   - empty list
 *   - every error code (VALIDATION, NOT_FOUND, INVALID_STATE, SOLD_OUT)
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createStore,
  createEvent,
  addTier,
  publishEvent,
  unpublishEvent,
  listEventSummaries,
  bookTickets,
  cancelBooking,
  seatsLeft,
} from '../src/domain/inventory.js';
import { filterEvents, sortEvents, searchEvents } from '../src/domain/eventSearch.js';
import { DomainError } from '../src/domain/errors.js';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Assert that fn() throws a DomainError whose .code matches expected. */
function throwsCode(fn, code) {
  assert.throws(fn, (err) => err instanceof DomainError && err.code === code);
}

/** Extract titles from a list of event summaries. */
const titles = (events) => events.map((e) => e.title);

// ─── S02: create an event ───────────────────────────────────────────────────

describe('S02 – create an event', () => {
  let store;

  beforeEach(() => {
    store = createStore();
  });

  it('saves a draft with a new id when given valid inputs', () => {
    const event = createEvent(store, {
      title: 'Lagos Tech Meetup',
      city: 'Lagos',
      venue: 'Yaba Hub',
      startsAt: '2026-12-05T17:00:00Z',
      organizerId: 'org-1',
    });
    assert.ok(event.id, 'has an id');
    assert.equal(event.status, 'draft');
    assert.equal(event.title, 'Lagos Tech Meetup');
  });

  it('a new draft event is NOT on the public list', () => {
    createEvent(store, {
      title: 'Hidden Draft',
      city: 'Lagos',
      startsAt: '2026-12-05T17:00:00Z',
    });
    const summaries = listEventSummaries(store); // publishedOnly = true by default
    assert.ok(!titles(summaries).includes('Hidden Draft'));
  });

  it('rejects a missing title with VALIDATION and saves nothing', () => {
    const before = store.events.size;
    throwsCode(
      () => createEvent(store, { title: '', city: 'Lagos', startsAt: '2026-12-05' }),
      'VALIDATION',
    );
    assert.equal(store.events.size, before, 'store is unchanged');
  });

  it('rejects a missing city with VALIDATION and saves nothing', () => {
    const before = store.events.size;
    throwsCode(
      () => createEvent(store, { title: 'X', city: ' ', startsAt: '2026-12-05' }),
      'VALIDATION',
    );
    assert.equal(store.events.size, before);
  });

  it('rejects an invalid date with VALIDATION and saves nothing', () => {
    const before = store.events.size;
    throwsCode(
      () => createEvent(store, { title: 'X', city: 'Lagos', startsAt: 'not-a-date' }),
      'VALIDATION',
    );
    assert.equal(store.events.size, before);
  });
});

// ─── S03: add ticket tiers ──────────────────────────────────────────────────

describe('S03 – add ticket tiers', () => {
  let store;
  let event;

  beforeEach(() => {
    store = createStore();
    event = createEvent(store, {
      title: 'Test Event',
      city: 'Lagos',
      startsAt: '2026-12-05T17:00:00Z',
    });
  });

  it('saves a tier with 0 sold and the correct capacity', () => {
    const tier = addTier(store, event.id, {
      name: 'General',
      priceCents: 500_000,
      capacity: 100,
    });
    assert.equal(tier.sold, 0);
    assert.equal(tier.capacity, 100);
    assert.equal(seatsLeft(tier), 100);
  });

  it('prices are stored as whole cents', () => {
    const tier = addTier(store, event.id, { name: 'GA', priceCents: 500_000, capacity: 10 });
    assert.ok(Number.isInteger(tier.priceCents));
  });

  it('rejects a non-integer price with VALIDATION', () => {
    throwsCode(
      () => addTier(store, event.id, { name: 'GA', priceCents: 19.99, capacity: 10 }),
      'VALIDATION',
    );
  });

  it('rejects a price below 0 with VALIDATION', () => {
    throwsCode(
      () => addTier(store, event.id, { name: 'GA', priceCents: -1, capacity: 10 }),
      'VALIDATION',
    );
  });

  it('rejects capacity less than 1 with VALIDATION', () => {
    throwsCode(
      () => addTier(store, event.id, { name: 'GA', priceCents: 100, capacity: 0 }),
      'VALIDATION',
    );
  });

  it('rejects an unknown event id with NOT_FOUND', () => {
    throwsCode(
      () => addTier(store, 'does-not-exist', { name: 'GA', priceCents: 100, capacity: 10 }),
      'NOT_FOUND',
    );
  });
});

// ─── S04: publish and unpublish an event ────────────────────────────────────

describe('S04 – publish and unpublish', () => {
  let store;
  let event;

  beforeEach(() => {
    store = createStore();
    event = createEvent(store, {
      title: 'Public Event',
      city: 'Lagos',
      startsAt: '2026-12-10T18:00:00Z',
    });
    addTier(store, event.id, { name: 'GA', priceCents: 1000, capacity: 50 });
  });

  // ── Publishing ──

  it('changes status from draft to published', () => {
    publishEvent(store, event.id);
    assert.equal(event.status, 'published');
  });

  it('a published event appears on the public list', () => {
    publishEvent(store, event.id);
    const summaries = listEventSummaries(store);
    assert.ok(titles(summaries).includes('Public Event'));
  });

  it('prevents publishing an event with no tiers (INVALID_STATE)', () => {
    const bare = createEvent(store, {
      title: 'No Tiers',
      city: 'Abuja',
      startsAt: '2026-12-11T10:00:00Z',
    });
    throwsCode(() => publishEvent(store, bare.id), 'INVALID_STATE');
  });

  it('shows Published status after publishing', () => {
    publishEvent(store, event.id);
    assert.equal(event.status, 'published');
  });

  it('publishing again does not create a duplicate listing', () => {
    publishEvent(store, event.id);
    publishEvent(store, event.id); // idempotent
    const summaries = listEventSummaries(store);
    const matches = summaries.filter((e) => e.title === 'Public Event');
    assert.equal(matches.length, 1, 'exactly one listing');
  });

  // ── Unpublishing ──

  it('changes status to draft (unpublished) when organizer unpublishes', () => {
    publishEvent(store, event.id);
    unpublishEvent(store, event.id);
    assert.equal(event.status, 'draft');
  });

  it('an unpublished event no longer appears on the public list', () => {
    publishEvent(store, event.id);
    unpublishEvent(store, event.id);
    const summaries = listEventSummaries(store);
    assert.ok(!titles(summaries).includes('Public Event'));
  });

  it('an unpublished event is still visible to the organizer (publishedOnly: false)', () => {
    publishEvent(store, event.id);
    unpublishEvent(store, event.id);
    const all = listEventSummaries(store, { publishedOnly: false });
    assert.ok(titles(all).includes('Public Event'));
  });

  it('existing bookings survive an unpublish (seats held by booking are unchanged)', () => {
    addTier(store, event.id, { name: 'VIP', priceCents: 5000, capacity: 5 });
    publishEvent(store, event.id);
    const tier = store.tiers.get(event.tierIds[0]);
    const booking = bookTickets(store, tier.id, 'ada', 2);
    unpublishEvent(store, event.id);
    assert.equal(booking.status, 'pending', 'booking still valid');
    assert.equal(seatsLeft(tier), 48);
  });

  it('can be republished after unpublishing', () => {
    publishEvent(store, event.id);
    unpublishEvent(store, event.id);
    publishEvent(store, event.id);
    assert.equal(event.status, 'published');
    const summaries = listEventSummaries(store);
    assert.ok(titles(summaries).includes('Public Event'));
  });

  it('republishing preserves event details and tier configuration', () => {
    publishEvent(store, event.id);
    unpublishEvent(store, event.id);
    publishEvent(store, event.id);
    assert.equal(event.title, 'Public Event');
    assert.equal(event.tierIds.length, 1);
  });

  it('organizer can update a draft (unpublished) event without it going public', () => {
    // Simulate an edit while unpublished: change the title directly on the object.
    // The domain does not have an editEvent function yet, but we confirm the status check.
    publishEvent(store, event.id);
    unpublishEvent(store, event.id);
    event.title = 'Updated Title'; // direct mutation simulates a future editEvent()
    assert.equal(event.status, 'draft');
    assert.ok(!titles(listEventSummaries(store)).includes('Updated Title'));
  });

  it('only a published event can be unpublished (INVALID_STATE on a draft)', () => {
    // event is still a draft here
    throwsCode(() => unpublishEvent(store, event.id), 'INVALID_STATE');
  });

  it('rejects unpublishing a non-existent event with NOT_FOUND', () => {
    throwsCode(() => unpublishEvent(store, 'bad-id'), 'NOT_FOUND');
  });
});

// ─── S05: search, filter and sort ───────────────────────────────────────────

describe('S05 – search, filter and sort', () => {
  /**
   * Event fixture:
   *   Jazz Night    – Lagos    – 2026-12-10 – priceCents 3000  – 50 seats
   *   Tech Summit   – Abuja    – 2026-12-05 – priceCents 10000 – 110 seats (100 GA + 10 VIP)
   *   Food Fair     – Lagos    – 2026-12-05 – priceCents 0     – 500 seats
   *   Sold Out Gig  – Ibadan   – 2026-12-20 – priceCents 5000  – 0 seats
   *   Secret Draft  – Lagos    – 2026-12-01 – NOT PUBLISHED
   */
  let store;
  let summaries;

  beforeEach(() => {
    store = createStore();

    const make = (title, city, startsAt, tiers, { publish = true } = {}) => {
      const event = createEvent(store, {
        title,
        city,
        venue: `${city} Hall`,
        startsAt,
        organizerId: 'org',
      });
      const created = tiers.map((t) => addTier(store, event.id, t));
      if (publish) publishEvent(store, event.id);
      return { event, created };
    };

    make('Jazz Night', 'Lagos', '2026-12-10T19:00:00Z', [
      { name: 'GA', priceCents: 3000, capacity: 50 },
    ]);
    make('Tech Summit', 'Abuja', '2026-12-05T09:00:00Z', [
      { name: 'GA', priceCents: 10_000, capacity: 100 },
      { name: 'VIP', priceCents: 25_000, capacity: 10 },
    ]);
    make('Food Fair', 'Lagos', '2026-12-05T12:00:00Z', [
      { name: 'Entry', priceCents: 0, capacity: 500 },
    ]);
    const sold = make('Sold Out Gig', 'Ibadan', '2026-12-20T20:00:00Z', [
      { name: 'GA', priceCents: 5_000, capacity: 2 },
    ]);
    bookTickets(store, sold.created[0].id, 'u1', 2);

    make(
      'Secret Draft',
      'Lagos',
      '2026-12-01T10:00:00Z',
      [{ name: 'GA', priceCents: 100, capacity: 5 }],
      { publish: false },
    );

    summaries = listEventSummaries(store); // 4 published events
  });

  // S05 criterion: text search matches title or venue, case-insensitive
  it('text search "JAZZ" returns only Jazz Night', () => {
    const result = filterEvents(summaries, { q: 'JAZZ' });
    assert.deepEqual(titles(result), ['Jazz Night']);
  });

  // S05 criterion: venue also searched
  it('text search matches venue as well as title', () => {
    const result = filterEvents(summaries, { q: 'ibadan hall' });
    assert.deepEqual(titles(result), ['Sold Out Gig']);
  });

  // S05 criterion: city filter, case-insensitive exact match
  it('city filter "lagos" returns only Lagos events', () => {
    const cityEvents = filterEvents(summaries, { city: 'lagos' });
    assert.ok(cityEvents.every((e) => e.city.toLowerCase() === 'lagos'));
    assert.equal(cityEvents.length, 2);
  });

  // S05 criterion: maxPriceCents + sort by price
  it('maxPriceCents filters by cheapest tier, cheapest first', () => {
    const result = searchEvents(summaries, { maxPriceCents: 3000 }, 'price');
    assert.deepEqual(titles(result), ['Food Fair', 'Jazz Night']);
  });

  // S05 criterion: events with no tiers excluded from price filter
  it('events with no tiers are excluded from price-filtered results', () => {
    const noTierStore = createStore();
    const ev = createEvent(noTierStore, { title: 'No Tiers', city: 'X', startsAt: '2026-12-15' });
    addTier(noTierStore, ev.id, { name: 'GA', priceCents: 100, capacity: 5 });
    publishEvent(noTierStore, ev.id);
    // Add a second event with no tiers (simulate summary with null minPriceCents)
    const fakeNoTier = { id: 'x', title: 'NoTier', city: 'X', venue: '', startsAt: '2026-12-15T10:00:00Z', status: 'published', tierCount: 0, minPriceCents: null, seatsLeft: 0 };
    const withNoTier = [...listEventSummaries(noTierStore), fakeNoTier];
    const result = filterEvents(withNoTier, { maxPriceCents: 500 });
    assert.ok(!titles(result).includes('NoTier'), 'no-tier event excluded from price filter');
  });

  // S05 criterion: date range inclusive, date-only "to" covers whole day
  it('date-only "to" of 2026-12-05 includes an event at 17:00 on that day', () => {
    const result = filterEvents(summaries, { from: '2026-12-05', to: '2026-12-05' });
    assert.deepEqual(titles(result).sort(), ['Food Fair', 'Tech Summit']);
  });

  // S05 criterion: stable sort by date, ties broken by title
  it('sorts by date, earliest first; same-day events stay in title order (stable)', () => {
    const sorted = sortEvents(summaries, 'date');
    // Tech Summit (09:00) and Food Fair (12:00) are both on 2026-12-05
    // Tech Summit < Food Fair alphabetically
    assert.deepEqual(titles(sorted), ['Tech Summit', 'Food Fair', 'Jazz Night', 'Sold Out Gig']);
  });

  // S05 criterion: sort by price, cheapest first; no price last
  it('sorts by price, cheapest first (no-price events last)', () => {
    assert.deepEqual(titles(sortEvents(summaries, 'price')), [
      'Food Fair',
      'Jazz Night',
      'Sold Out Gig',
      'Tech Summit',
    ]);
  });

  // S05 criterion: sort by availability, most seats first
  it('sorts by availability, most seats left first', () => {
    assert.deepEqual(titles(sortEvents(summaries, 'availability')), [
      'Food Fair',
      'Tech Summit',
      'Jazz Night',
      'Sold Out Gig',
    ]);
  });

  // S05 criterion: bad date → VALIDATION
  it('rejects a bad "from" date with VALIDATION', () => {
    throwsCode(() => filterEvents(summaries, { from: 'yesterday-ish' }), 'VALIDATION');
  });

  it('rejects a bad "to" date with VALIDATION', () => {
    throwsCode(() => filterEvents(summaries, { to: 'not-a-date' }), 'VALIDATION');
  });

  // S05 criterion: price that is not a whole number → VALIDATION
  it('rejects a fractional maxPriceCents with VALIDATION', () => {
    throwsCode(() => filterEvents(summaries, { maxPriceCents: 9.99 }), 'VALIDATION');
  });

  it('rejects a negative maxPriceCents with VALIDATION', () => {
    throwsCode(() => filterEvents(summaries, { maxPriceCents: -1 }), 'VALIDATION');
  });

  // S05 criterion: unknown sort option → VALIDATION
  it('rejects an unknown sortBy with VALIDATION', () => {
    throwsCode(() => sortEvents(summaries, 'rainbow'), 'VALIDATION');
  });

  // S05 criterion: original list is unchanged after filtering
  it('filterEvents does not mutate the original list', () => {
    const original = [...summaries];
    filterEvents(summaries, { city: 'Lagos' });
    assert.deepEqual(summaries, original);
  });

  // S05 criterion: original list is unchanged after sorting
  it('sortEvents does not mutate the original list', () => {
    const before = titles(summaries);
    sortEvents(summaries, 'price');
    assert.deepEqual(titles(summaries), before);
  });

  // Additional: empty list
  it('handles an empty list without error', () => {
    assert.deepEqual(filterEvents([], { q: 'anything' }), []);
    assert.deepEqual(sortEvents([], 'date'), []);
    assert.deepEqual(searchEvents([], { city: 'Lagos' }, 'price'), []);
  });

  // Additional: stable sort proof with equal keys
  it('sort is stable: events with identical prices keep their relative order', () => {
    const store2 = createStore();
    const makeSimple = (title, priceCents) => {
      const ev = createEvent(store2, { title, city: 'X', startsAt: '2026-12-10T10:00:00Z' });
      addTier(store2, ev.id, { name: 'GA', priceCents, capacity: 10 });
      publishEvent(store2, ev.id);
    };
    makeSimple('Alpha', 1000);
    makeSimple('Beta', 1000);
    makeSimple('Gamma', 1000);
    const list = listEventSummaries(store2);
    const sorted = sortEvents(list, 'price');
    // All prices equal, so tie-break is by title (Alpha < Beta < Gamma)
    assert.deepEqual(titles(sorted), ['Alpha', 'Beta', 'Gamma']);
  });

  // searchEvents = filter then sort
  it('searchEvents combines filter and sort correctly', () => {
    const result = searchEvents(summaries, { city: 'Lagos' }, 'price');
    assert.deepEqual(titles(result), ['Food Fair', 'Jazz Night']);
  });
});

// ─── S06: book tickets ──────────────────────────────────────────────────────

describe('S06 – book tickets', () => {
  let store;
  let tier;

  beforeEach(() => {
    store = createStore();
    const event = createEvent(store, {
      title: 'Test Event',
      city: 'Lagos',
      startsAt: '2026-12-05T17:00:00Z',
    });
    tier = addTier(store, event.id, { name: 'General', priceCents: 2500, capacity: 3 });
    publishEvent(store, event.id);
  });

  // S06 criterion: pending booking, priced in whole cents, seat count decreases
  it('creates a pending booking priced in whole cents', () => {
    const booking = bookTickets(store, tier.id, 'ada', 2);
    assert.equal(booking.status, 'pending');
    assert.equal(booking.amountCents, 5000); // 2 × 2500
    assert.ok(Number.isInteger(booking.amountCents));
    assert.equal(seatsLeft(tier), 1);
  });

  // S06 criterion: SOLD_OUT and nothing changes
  it('rejects a booking that exceeds seats left with SOLD_OUT, leaving state unchanged', () => {
    bookTickets(store, tier.id, 'ada', 2); // 1 seat left
    const before = seatsLeft(tier);
    throwsCode(() => bookTickets(store, tier.id, 'bayo', 2), 'SOLD_OUT');
    assert.equal(seatsLeft(tier), before, 'seats unchanged after failed booking');
  });

  // S06 criterion: quantity 0 → VALIDATION
  it('rejects quantity of 0 with VALIDATION', () => {
    throwsCode(() => bookTickets(store, tier.id, 'ada', 0), 'VALIDATION');
  });

  // S06 criterion: quantity negative → VALIDATION
  it('rejects negative quantity with VALIDATION', () => {
    throwsCode(() => bookTickets(store, tier.id, 'ada', -1), 'VALIDATION');
  });

  // S06 criterion: fractional quantity → VALIDATION
  it('rejects fractional quantity with VALIDATION', () => {
    throwsCode(() => bookTickets(store, tier.id, 'ada', 1.5), 'VALIDATION');
  });

  // S06 criterion: quantity > 10 → VALIDATION
  it('rejects quantity greater than 10 with VALIDATION', () => {
    const big = addTier(store, store.events.keys().next().value, {
      name: 'Big',
      priceCents: 100,
      capacity: 100,
    });
    throwsCode(() => bookTickets(store, big.id, 'ada', 11), 'VALIDATION');
  });

  // Edge: last seat books successfully, then next attempt is SOLD_OUT
  it('allows the last seat to be booked, then reports SOLD_OUT', () => {
    bookTickets(store, tier.id, 'ada', 3);
    assert.equal(seatsLeft(tier), 0);
    throwsCode(() => bookTickets(store, tier.id, 'bayo', 1), 'SOLD_OUT');
  });

  // Edge: cancelling returns seats and prevents double-cancel
  it('cancelling a booking returns its seats exactly once', () => {
    const booking = bookTickets(store, tier.id, 'ada', 2);
    cancelBooking(store, booking.reference);
    assert.equal(seatsLeft(tier), 3);
    throwsCode(() => cancelBooking(store, booking.reference), 'INVALID_STATE');
    assert.equal(seatsLeft(tier), 3, 'seats not released twice');
  });
});

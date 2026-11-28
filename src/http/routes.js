import { DomainError } from '../domain/errors.js';
import { OPENAPI_SPEC } from './openapi.js';

function getUserId(request) {
  const value = request.headers['x-user-id'];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function requireJsonObject(body) {
  if (body === undefined || body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new DomainError('VALIDATION', 'Request body must be a JSON object');
  }
  return body;
}

function parseOptionalInt(value) {
  if (value === undefined || value === '') return undefined;
  return Number(value);
}

export function registerApiRoutes(router, { eventService, bookingService }) {
  router.get('/openapi.json', () => ({ status: 200, body: OPENAPI_SPEC }));

  router.post('/api/events', async ({ request, body }) => {
    const payload = requireJsonObject(body);
    const event = await eventService.createEvent({
      organizerId: getUserId(request),
      title: payload.title,
      city: payload.city,
      venue: payload.venue,
      startsAt: payload.startsAt,
    });
    return { status: 201, body: { event } };
  });

  router.post('/api/events/:id/tiers', async ({ request, params, body }) => {
    const payload = requireJsonObject(body);
    const tier = await eventService.addTier({
      organizerId: getUserId(request),
      eventId: params.id,
      name: payload.name,
      priceCents: payload.priceCents,
      capacity: payload.capacity,
    });
    return { status: 201, body: { tier } };
  });

  router.post('/api/events/:id/publish', async ({ request, params }) => {
    const event = await eventService.publishEvent({
      organizerId: getUserId(request),
      eventId: params.id,
    });
    return { status: 200, body: { event } };
  });

  router.post('/api/events/:id/unpublish', async ({ request, params }) => {
    const event = await eventService.unpublishEvent({
      organizerId: getUserId(request),
      eventId: params.id,
    });
    return { status: 200, body: { event } };
  });

  router.get('/api/events', async ({ query }) => {
    const events = await eventService.searchPublishedEvents({
      q: query.q || undefined,
      city: query.city || undefined,
      from: query.from || undefined,
      to: query.to || undefined,
      maxPriceCents: parseOptionalInt(query.maxPriceCents),
      onlyAvailable: query.onlyAvailable === 'true' || query.onlyAvailable === '1',
      sort: query.sort || 'date',
    });
    return { status: 200, body: { events } };
  });

  router.get('/api/events/:id', async ({ request, params }) => {
    const event = await eventService.getEvent({
      eventId: params.id,
      viewerId: getUserId(request),
    });
    return { status: 200, body: { event } };
  });

  router.post('/api/bookings', async ({ request, body }) => {
    const payload = requireJsonObject(body);
    const booking = await bookingService.bookTickets({
      userId: getUserId(request),
      tierId: payload.tierId,
      quantity: payload.quantity,
    });
    return { status: 201, body: { booking } };
  });

  router.get('/api/bookings/:reference', async ({ request, params }) => {
    const booking = await bookingService.getBooking({
      userId: getUserId(request),
      reference: params.reference,
    });
    return { status: 200, body: { booking } };
  });

  router.post('/api/bookings/:reference/pay', async ({ request, params, body }) => {
    const payload = requireJsonObject(body);
    const booking = await bookingService.payForBooking({
      userId: getUserId(request),
      reference: params.reference,
      paymentToken: payload.paymentToken,
    });
    return { status: 200, body: { booking } };
  });

  router.post('/api/bookings/:reference/cancel', async ({ request, params }) => {
    const booking = await bookingService.cancelBooking({
      userId: getUserId(request),
      reference: params.reference,
    });
    return { status: 200, body: { booking } };
  });

  return router;
}

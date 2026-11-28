const errorRef = { $ref: '#/components/schemas/ErrorResponse' };

function jsonResponse(description, schema) {
  return {
    description,
    content: { 'application/json': { schema } },
  };
}

function errorResponse(description) {
  return jsonResponse(description, errorRef);
}

export const OPENAPI_SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'Event Ticketing API',
    version: '0.1.0',
    description: 'Build 4 in-memory REST API for events, ticket tiers, bookings, and mock payments.',
  },
  servers: [{ url: 'http://localhost:3000' }],
  components: {
    securitySchemes: {
      UserId: {
        type: 'apiKey',
        in: 'header',
        name: 'x-user-id',
        description: 'Temporary caller identifier until Build 7 authentication.',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string', example: 'VALIDATION' },
              message: { type: 'string', example: 'Title is required' },
            },
          },
        },
      },
      Event: {
        type: 'object',
        required: ['id', 'organizerId', 'title', 'city', 'venue', 'startsAt', 'status'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          organizerId: { type: 'string', example: 'org-1' },
          title: { type: 'string', example: 'Lagos Jazz Night' },
          city: { type: 'string', example: 'Lagos' },
          venue: { type: 'string', example: 'Muson Centre' },
          startsAt: { type: 'string', format: 'date-time' },
          status: { type: 'string', enum: ['draft', 'published'] },
        },
      },
      Tier: {
        type: 'object',
        required: ['id', 'eventId', 'name', 'priceCents', 'capacity', 'sold'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          eventId: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'General' },
          priceCents: { type: 'integer', minimum: 0, example: 500000 },
          capacity: { type: 'integer', minimum: 1, example: 100 },
          sold: { type: 'integer', minimum: 0, example: 0 },
        },
      },
      EventSummary: {
        type: 'object',
        required: ['id', 'title', 'city', 'venue', 'startsAt', 'status', 'tierCount', 'minPriceCents', 'seatsLeft'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          city: { type: 'string' },
          venue: { type: 'string' },
          startsAt: { type: 'string', format: 'date-time' },
          status: { type: 'string', enum: ['published'] },
          tierCount: { type: 'integer' },
          minPriceCents: { type: ['integer', 'null'] },
          seatsLeft: { type: 'integer' },
        },
      },
      EventWithTiers: {
        allOf: [
          { $ref: '#/components/schemas/Event' },
          {
            type: 'object',
            required: ['tiers'],
            properties: {
              tiers: { type: 'array', items: { $ref: '#/components/schemas/Tier' } },
            },
          },
        ],
      },
      Booking: {
        type: 'object',
        required: ['id', 'reference', 'userId', 'tierId', 'quantity', 'amountCents', 'status', 'createdAt'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          reference: { type: 'string', example: 'AB3K9M2P' },
          userId: { type: 'string', example: 'user-1' },
          tierId: { type: 'string', format: 'uuid' },
          quantity: { type: 'integer', minimum: 1, maximum: 10 },
          amountCents: { type: 'integer', minimum: 0 },
          status: { type: 'string', enum: ['pending', 'paid', 'cancelled', 'refunded', 'checked_in'] },
          createdAt: { type: 'string', format: 'date-time' },
          paidAt: { type: 'string', format: 'date-time' },
          cancelledAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        responses: {
          200: jsonResponse('Server is healthy', {
            type: 'object',
            required: ['status'],
            properties: { status: { type: 'string', example: 'ok' } },
          }),
        },
      },
    },
    '/api/events': {
      get: {
        summary: 'Search, filter, and sort published events',
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Match title or venue (case-insensitive)' },
          { name: 'city', in: 'query', schema: { type: 'string' }, description: 'Exact city match (case-insensitive)' },
          { name: 'from', in: 'query', schema: { type: 'string' }, description: 'Start date/time (ISO)' },
          { name: 'to', in: 'query', schema: { type: 'string' }, description: 'End date/time (ISO; date-only includes whole day)' },
          { name: 'maxPriceCents', in: 'query', schema: { type: 'integer', minimum: 0 } },
          { name: 'onlyAvailable', in: 'query', schema: { type: 'boolean' } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['date', 'price', 'availability'], default: 'date' } },
        ],
        responses: {
          200: jsonResponse('Published event summaries', {
            type: 'object',
            required: ['events'],
            properties: { events: { type: 'array', items: { $ref: '#/components/schemas/EventSummary' } } },
          }),
          400: errorResponse('Invalid filter or sort parameter'),
        },
      },
      post: {
        summary: 'Create a draft event',
        security: [{ UserId: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'city', 'startsAt'],
                properties: {
                  title: { type: 'string', example: 'Lagos Jazz Night' },
                  city: { type: 'string', example: 'Lagos' },
                  venue: { type: 'string', example: 'Muson Centre' },
                  startsAt: { type: 'string', format: 'date-time', example: '2026-12-05T19:00:00Z' },
                },
              },
            },
          },
        },
        responses: {
          201: jsonResponse('Draft event created', {
            type: 'object',
            required: ['event'],
            properties: { event: { $ref: '#/components/schemas/Event' } },
          }),
          400: errorResponse('Validation or JSON error'),
          401: errorResponse('Missing x-user-id header'),
        },
      },
    },
    '/api/events/{id}': {
      get: {
        summary: 'Get an event and its ticket tiers',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: jsonResponse('Event details with tiers', {
            type: 'object',
            required: ['event'],
            properties: { event: { $ref: '#/components/schemas/EventWithTiers' } },
          }),
          404: errorResponse('Event not found (or draft hidden from non-organizer)'),
        },
      },
    },
    '/api/events/{id}/tiers': {
      post: {
        summary: 'Add a ticket tier to an event',
        security: [{ UserId: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'priceCents', 'capacity'],
                properties: {
                  name: { type: 'string', example: 'General' },
                  priceCents: { type: 'integer', minimum: 0, example: 500000 },
                  capacity: { type: 'integer', minimum: 1, example: 100 },
                },
              },
            },
          },
        },
        responses: {
          201: jsonResponse('Ticket tier created', {
            type: 'object',
            required: ['tier'],
            properties: { tier: { $ref: '#/components/schemas/Tier' } },
          }),
          400: errorResponse('Validation or JSON error'),
          401: errorResponse('Missing x-user-id header'),
          403: errorResponse('Caller is not the event organizer'),
          404: errorResponse('Event not found'),
        },
      },
    },
    '/api/events/{id}/publish': {
      post: {
        summary: 'Publish an event',
        security: [{ UserId: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: jsonResponse('Event published', {
            type: 'object',
            required: ['event'],
            properties: { event: { $ref: '#/components/schemas/Event' } },
          }),
          401: errorResponse('Missing x-user-id header'),
          403: errorResponse('Caller is not the event organizer'),
          404: errorResponse('Event not found'),
          409: errorResponse('Event has no ticket tiers'),
        },
      },
    },
    '/api/events/{id}/unpublish': {
      post: {
        summary: 'Unpublish an event back to draft',
        security: [{ UserId: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: jsonResponse('Event unpublished', {
            type: 'object',
            required: ['event'],
            properties: { event: { $ref: '#/components/schemas/Event' } },
          }),
          401: errorResponse('Missing x-user-id header'),
          403: errorResponse('Caller is not the event organizer'),
          404: errorResponse('Event not found'),
          409: errorResponse('Event is not currently published'),
        },
      },
    },
    '/api/bookings': {
      post: {
        summary: 'Book tickets from a published event tier',
        security: [{ UserId: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['tierId', 'quantity'],
                properties: {
                  tierId: { type: 'string', format: 'uuid' },
                  quantity: { type: 'integer', minimum: 1, maximum: 10, example: 2 },
                },
              },
            },
          },
        },
        responses: {
          201: jsonResponse('Pending booking created', {
            type: 'object',
            required: ['booking'],
            properties: { booking: { $ref: '#/components/schemas/Booking' } },
          }),
          400: errorResponse('Validation or JSON error'),
          401: errorResponse('Missing x-user-id header'),
          404: errorResponse('Ticket tier not found'),
          409: errorResponse('Sold out or event not published'),
        },
      },
    },
    '/api/bookings/{reference}': {
      get: {
        summary: 'Get a booking by its reference code',
        security: [{ UserId: [] }],
        parameters: [{ name: 'reference', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: jsonResponse('Booking details', {
            type: 'object',
            required: ['booking'],
            properties: { booking: { $ref: '#/components/schemas/Booking' } },
          }),
          401: errorResponse('Missing x-user-id header'),
          403: errorResponse('Caller does not own this booking'),
          404: errorResponse('Booking not found'),
        },
      },
    },
    '/api/bookings/{reference}/pay': {
      post: {
        summary: 'Pay for a pending booking via mock payment gateway',
        security: [{ UserId: [] }],
        parameters: [{ name: 'reference', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['paymentToken'],
                properties: {
                  paymentToken: { type: 'string', example: 'tok_valid' },
                },
              },
            },
          },
        },
        responses: {
          200: jsonResponse('Booking paid', {
            type: 'object',
            required: ['booking'],
            properties: { booking: { $ref: '#/components/schemas/Booking' } },
          }),
          400: errorResponse('Validation or JSON error'),
          401: errorResponse('Missing x-user-id header'),
          402: errorResponse('Payment declined (booking stays pending)'),
          403: errorResponse('Caller does not own this booking'),
          404: errorResponse('Booking not found'),
          409: errorResponse('Invalid state transition (e.g. already paid or cancelled)'),
        },
      },
    },
    '/api/bookings/{reference}/cancel': {
      post: {
        summary: 'Cancel an unpaid (pending) booking and release its seats',
        security: [{ UserId: [] }],
        parameters: [{ name: 'reference', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: jsonResponse('Booking cancelled', {
            type: 'object',
            required: ['booking'],
            properties: { booking: { $ref: '#/components/schemas/Booking' } },
          }),
          401: errorResponse('Missing x-user-id header'),
          403: errorResponse('Caller does not own this booking'),
          404: errorResponse('Booking not found'),
          409: errorResponse('Booking is not pending or already cancelled'),
        },
      },
    },
  },
};

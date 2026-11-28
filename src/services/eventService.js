import { DomainError } from '../domain/errors.js';
import { searchEvents, summarizeEvent } from '../domain/eventSearch.js';
import { newId } from '../domain/ids.js';
import { requireDate, requireText, requireWholeNumber } from '../domain/validation.js';

function requireUser(userId) {
  if (typeof userId !== 'string' || !userId.trim()) {
    throw new DomainError('UNAUTHENTICATED', 'x-user-id header is required');
  }
  return userId.trim();
}

async function getOwnedEvent(repository, eventId, organizerId) {
  const actor = requireUser(organizerId);
  const event = await repository.findEventById(eventId);
  if (!event) throw new DomainError('NOT_FOUND', 'Event not found');
  if (event.organizerId !== actor) {
    throw new DomainError('FORBIDDEN', 'Only the organizer can manage this event');
  }
  return event;
}

export function createEventService({ repository }) {
  return {
    async createEvent({ organizerId, title, city, venue = '', startsAt }) {
      const actor = requireUser(organizerId);
      const event = {
        id: newId(),
        organizerId: actor,
        title: requireText(title, 'Title'),
        city: requireText(city, 'City'),
        venue: typeof venue === 'string' ? venue.trim() : '',
        startsAt: requireDate(startsAt, 'startsAt'),
        status: 'draft',
      };
      return repository.createEvent(event);
    },

    async addTier({ organizerId, eventId, name, priceCents, capacity }) {
      await getOwnedEvent(repository, eventId, organizerId);
      const tier = {
        id: newId(),
        eventId,
        name: requireText(name, 'Tier name'),
        priceCents: requireWholeNumber(priceCents, 'priceCents', 0),
        capacity: requireWholeNumber(capacity, 'capacity', 1),
        sold: 0,
      };
      return repository.createTier(tier);
    },

    async publishEvent({ organizerId, eventId }) {
      const event = await getOwnedEvent(repository, eventId, organizerId);
      const tiers = await repository.listTiersByEvent(eventId);
      if (tiers.length === 0) {
        throw new DomainError('INVALID_STATE', 'Add at least one ticket tier before publishing');
      }
      event.status = 'published';
      return repository.updateEvent(event);
    },

    async unpublishEvent({ organizerId, eventId }) {
      const event = await getOwnedEvent(repository, eventId, organizerId);
      if (event.status !== 'published') {
        throw new DomainError('INVALID_STATE', `Only a published event can be unpublished (current status: ${event.status})`);
      }
      event.status = 'draft';
      return repository.updateEvent(event);
    },

    async getEvent({ eventId, viewerId }) {
      const event = await repository.findEventById(eventId);
      if (!event || (event.status !== 'published' && event.organizerId !== viewerId)) {
        throw new DomainError('NOT_FOUND', 'Event not found');
      }
      const tiers = await repository.listTiersByEvent(eventId);
      return { ...event, tiers };
    },

    async searchPublishedEvents({ q, city, from, to, maxPriceCents, onlyAvailable, sort = 'date' } = {}) {
      const events = await repository.listEvents();
      const published = events.filter((event) => event.status === 'published');
      const summaries = await Promise.all(
        published.map(async (event) => {
          const tiers = await repository.listTiersByEvent(event.id);
          return summarizeEvent(event, tiers);
        }),
      );
      return searchEvents(summaries, { q, city, from, to, maxPriceCents, onlyAvailable }, sort);
    },
  };
}

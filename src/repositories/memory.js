export function createMemoryRepository() {
  const events = new Map();
  const tiers = new Map();
  const bookings = new Map();

  return {
    async createEvent(event) {
      const record = { ...event };
      events.set(record.id, record);
      return { ...record };
    },

    async findEventById(id) {
      const record = events.get(id);
      return record ? { ...record } : null;
    },

    async updateEvent(event) {
      if (!events.has(event.id)) return null;
      const record = { ...event };
      events.set(record.id, record);
      return { ...record };
    },

    async listEvents() {
      return [...events.values()].map((event) => ({ ...event }));
    },

    async createTier(tier) {
      const record = { ...tier };
      tiers.set(record.id, record);
      return { ...record };
    },

    async findTierById(id) {
      const record = tiers.get(id);
      return record ? { ...record } : null;
    },

    async listTiersByEvent(eventId) {
      return [...tiers.values()]
        .filter((tier) => tier.eventId === eventId)
        .map((tier) => ({ ...tier }));
    },

    async updateTier(tier) {
      if (!tiers.has(tier.id)) return null;
      const record = { ...tier };
      tiers.set(record.id, record);
      return { ...record };
    },

    async createBooking(booking) {
      const record = { ...booking };
      bookings.set(record.reference, record);
      return { ...record };
    },

    async findBookingByReference(reference) {
      const record = bookings.get(reference);
      return record ? { ...record } : null;
    },

    async updateBooking(booking) {
      if (!bookings.has(booking.reference)) return null;
      const record = { ...booking };
      bookings.set(record.reference, record);
      return { ...record };
    },
  };
}

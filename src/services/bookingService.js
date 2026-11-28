import { assertTransition } from '../domain/bookingStateMachine.js';
import { DomainError } from '../domain/errors.js';
import { newId, referenceCode } from '../domain/ids.js';
import { assertSeatsAvailable, requireQuantity, requireText } from '../domain/validation.js';

function requireUser(userId) {
  if (typeof userId !== 'string' || !userId.trim()) {
    throw new DomainError('UNAUTHENTICATED', 'x-user-id header is required');
  }
  return userId.trim();
}

async function getOwnedBooking(repository, reference, userId) {
  const actor = requireUser(userId);
  const booking = await repository.findBookingByReference(reference);
  if (!booking) throw new DomainError('NOT_FOUND', 'Booking not found');
  if (booking.userId !== actor) {
    throw new DomainError('FORBIDDEN', 'You do not have access to this booking');
  }
  return booking;
}

export function createBookingService({ repository, paymentGateway }) {
  return {
    async bookTickets({ userId, tierId, quantity }) {
      const actor = requireUser(userId);
      const validQuantity = requireQuantity(quantity);

      const tier = await repository.findTierById(tierId);
      if (!tier) throw new DomainError('NOT_FOUND', 'Ticket tier not found');

      const event = await repository.findEventById(tier.eventId);
      if (!event || event.status !== 'published') {
        throw new DomainError('INVALID_STATE', 'Event is not open for booking');
      }

      assertSeatsAvailable(tier, validQuantity);
      tier.sold += validQuantity;
      await repository.updateTier(tier);

      let reference;
      do {
        reference = referenceCode();
      } while (await repository.findBookingByReference(reference));

      const booking = {
        id: newId(),
        reference,
        userId: actor,
        tierId: tier.id,
        quantity: validQuantity,
        amountCents: tier.priceCents * validQuantity,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      return repository.createBooking(booking);
    },

    async payForBooking({ userId, reference, paymentToken }) {
      const token = requireText(paymentToken, 'paymentToken');
      const booking = await getOwnedBooking(repository, reference, userId);

      assertTransition(booking.status, 'paid');

      const charge = await paymentGateway.charge({
        amountCents: booking.amountCents,
        reference: booking.reference,
        paymentToken: token,
      });

      if (!charge.approved) {
        throw new DomainError('PAYMENT_DECLINED', charge.reason ?? 'Payment was declined');
      }

      booking.status = 'paid';
      booking.paidAt = new Date().toISOString();
      return repository.updateBooking(booking);
    },

    async cancelBooking({ userId, reference }) {
      const booking = await getOwnedBooking(repository, reference, userId);

      assertTransition(booking.status, 'cancelled');
      if (booking.status !== 'pending') {
        throw new DomainError('INVALID_STATE', 'Only pending bookings can be cancelled');
      }

      const tier = await repository.findTierById(booking.tierId);
      if (tier) {
        tier.sold -= booking.quantity;
        await repository.updateTier(tier);
      }

      booking.status = 'cancelled';
      booking.cancelledAt = new Date().toISOString();
      return repository.updateBooking(booking);
    },

    async getBooking({ userId, reference }) {
      return getOwnedBooking(repository, reference, userId);
    },
  };
}

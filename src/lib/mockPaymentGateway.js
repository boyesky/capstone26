import { newId } from '../domain/ids.js';

export function createMockPaymentGateway() {
  return {
    async charge({ amountCents, reference, paymentToken }) {
      if (typeof paymentToken !== 'string' || !paymentToken.trim()) {
        return { approved: false, reason: 'Payment token is required' };
      }
      if (paymentToken === 'tok_decline' || paymentToken.startsWith('tok_decline_')) {
        return { approved: false, reason: 'Mock payment declined' };
      }
      return {
        approved: true,
        transactionId: newId(),
        amountCents,
        reference,
      };
    },
  };
}

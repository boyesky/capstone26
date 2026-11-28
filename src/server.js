import { pathToFileURL } from 'node:url';
import { createAppServer } from './http/app.js';
import { Router } from './http/router.js';
import { registerApiRoutes } from './http/routes.js';
import { createMockPaymentGateway } from './lib/mockPaymentGateway.js';
import { createMemoryRepository } from './repositories/memory.js';
import { createBookingService } from './services/bookingService.js';
import { createEventService } from './services/eventService.js';
import { PORT } from './config.js';

export function createTicketingServer({
  repository = createMemoryRepository(),
  paymentGateway = createMockPaymentGateway(),
} = {}) {
  const eventService = createEventService({ repository });
  const bookingService = createBookingService({ repository, paymentGateway });
  const router = registerApiRoutes(new Router(), { eventService, bookingService });
  return createAppServer({ router });
}

export function startServer(port = PORT) {
  const server = createTicketingServer();
  server.listen(port, () => {
    console.log(`Event ticketing server listening on port ${port}`);
  });

  const shutDown = () => server.close(() => process.exit(0));
  process.once('SIGINT', shutDown);
  process.once('SIGTERM', shutDown);
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer();
}

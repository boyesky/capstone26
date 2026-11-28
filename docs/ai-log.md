# AI log

Every time you give an AI tool a significant prompt, add an entry. Three lines each.
"Nothing was wrong" is allowed, but it is rarely true. Your instructor will read this.

## Build 1

### Prompt : Build 1 prompt (docs/build-1.md)

- **What I asked:** Create the domain core in the terminal: `src/domain/errors.js`, `src/domain/ids.js`, `src/domain/waitlistQueue.js`, `src/domain/inventory.js`, `scripts/demo.js`, and `scripts/benchmark-lookup.js`. Set `"type": "module"` in `package.json`. Rules: money as whole cents, validate every input with a `DomainError`, a failed booking must change nothing, O(1) waitlist queue with no `array.shift()`, O(1) reference lookup with a `Map`.
- **What came back:** All six files plus `src/domain/validation.js` (input rules) and `src/domain/eventSearch.js` (event filtering, used by Build 2). `ids.js` exported `referenceCode()` instead of `newReference()` as the prompt specified. The Queue used private fields (`#head`, `#tail`, `#size`) and a linked list. `inventory.js` guarded the SOLD_OUT path with `assertSeatsAvailable` before mutating `tier.sold`, so a failed booking leaves no trace. `cancelBooking` used a `HOLDS_SEATS` set so cancelling twice throws `INVALID_STATE`. The benchmark showed Map ~1500× faster than `Array.find` over 100,000 bookings.
- **What was wrong (or "nothing"):** The exported function name was `referenceCode()` instead of `newReference()` as the prompt asked; added `export const newReference = referenceCode` as an alias so both names work.

## Build 2

### Prompt : Build 2 prompt (docs/build-2.md)

- **What I asked:** Implement Build 2: `src/domain/sorting.js` (`mergeSort`), `publishEvent` and `listEventSummaries` in `src/domain/inventory.js`, `src/domain/eventSearch.js` (`filterEvents`, `sortEvents`, `searchEvents`), `node:test` acceptance tests for S02–S06 in `test/`, and the `npm test` script in `package.json`.
- **What came back:** Verified the existing `sorting.js`, `eventSearch.js`, `publishEvent`, `listEventSummaries`, and `package.json` `"test"` script. Added `unpublishEvent(store, eventId)` to `src/domain/inventory.js` and created `test/build2.test.js` with 52 acceptance tests covering S02, S03, S04 (publish & unpublish), S05, and S06, including immutability, sort stability, empty lists, and all error codes (`VALIDATION`, `NOT_FOUND`, `INVALID_STATE`, `SOLD_OUT`).
- **What was wrong (or "nothing"):** `unpublishEvent` was missing from `src/domain/inventory.js`, and the existing domain tests (`sorting.test.js`, `eventSearch.test.js`, `inventory.test.js`) missed several `docs/build-2.md` criteria (S04 unpublish/republish/idempotent publish, S03 `NOT_FOUND`, S02 no-save on failure). `unpublishEvent` sets status back to `'draft'` because the domain only defines `'draft'` and `'published'`. Also, `test/build2.test.js` simulates editing an unpublished event by mutating `event.title` directly because there is no `editEvent` function in `inventory.js`.

## Build 3

### Prompt : Build 3 prompt (docs/build-3.md)

- **What I asked:** Add the architecture diagrams (`docs/architecture.md`), booking state machine (`src/domain/bookingStateMachine.js`), Node HTTP router/server (`src/http/router.js`, `src/http/app.js`), configuration (`src/config.js`, `src/server.js`), `"start"` script in `package.json`, and `node:test` tests.
- **What came back:** A layered architecture document, explicit booking transitions, static-file HTTP server, `/health` route, startup configuration, and `node:test` coverage.
- **What was wrong (or "nothing"):** The first server draft relied on an implicit response/request property for HEAD handling and had redundant error-status logic; both were simplified. Added a regression test proving static requests cannot escape `public/`.

## Build 4

### Prompt : Build 4 prompt (docs/build-4.md)

- **What I asked:** Build the in-memory REST API: `src/repositories/memory.js`, `src/services/eventService.js`, `src/services/bookingService.js` (reusing `src/domain/` rules), `src/lib/mockPaymentGateway.js`, API routes in `src/http/routes.js`, wiring in `src/server.js`, `docs/api-examples.md`, and `node:test` API tests on a free port (`test/api.test.js`).
- **What came back:** All requested files plus convenience endpoints (`POST /api/events/:id/unpublish`, `GET /api/events/:id`, and `GET /api/bookings/:reference`) and 10 end-to-end API tests in `test/api.test.js`. `npm test` ran and all 106 tests across 25 suites passed.
- **What was wrong (or "nothing"):** Nothing in the test run; rules decided explicitly: missing `x-user-id` returns `401 UNAUTHENTICATED`, accessing another user's event/booking returns `403 FORBIDDEN`, `venue` stays optional (defaulting to `''`), and `cancelBooking` rejects `paid` bookings with `409 INVALID_STATE` while already-cancelled bookings fail `assertTransition` with `409 INVALID_TRANSITION`. Known gap left for Build 5: concurrent `bookTickets` calls can read the same `tier.sold` before updating.

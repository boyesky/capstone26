# API Examples (Build 4)

Start the server first:

```bash
npm start
```

On Windows PowerShell, use `curl.exe` instead of `curl`. Save the returned IDs (`EVENT_ID`, `TIER_ID`, `BOOKING_REF`) as you go.

## 1. Create an event (Organizer)

```bash
curl.exe -s -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -H "x-user-id: org-1" \
  -d '{"title":"Lagos Jazz Night","city":"Lagos","venue":"Muson Centre","startsAt":"2026-12-05T19:00:00Z"}'
```

## 2. Add a ticket tier (Organizer)

```bash
curl.exe -s -X POST http://localhost:3000/api/events/EVENT_ID/tiers \
  -H "Content-Type: application/json" \
  -H "x-user-id: org-1" \
  -d '{"name":"General","priceCents":500000,"capacity":100}'
```

## 3. Publish the event (Organizer)

```bash
curl.exe -s -X POST http://localhost:3000/api/events/EVENT_ID/publish \
  -H "x-user-id: org-1"
```

## 4. Search, filter, and sort published events

```bash
curl.exe -s "http://localhost:3000/api/events?city=lagos&q=jazz&maxPriceCents=600000&sort=price"
```

## 5. View a single event with its tiers

```bash
curl.exe -s http://localhost:3000/api/events/EVENT_ID
```

## 6. Book tickets (Attendee)

```bash
curl.exe -s -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -H "x-user-id: user-1" \
  -d '{"tierId":"TIER_ID","quantity":2}'
```

## 7. View a booking by reference (Attendee)

```bash
curl.exe -s http://localhost:3000/api/bookings/BOOKING_REF \
  -H "x-user-id: user-1"
```

## 8. Pay for a booking (Attendee)

Valid mock payment:

```bash
curl.exe -s -X POST http://localhost:3000/api/bookings/BOOKING_REF/pay \
  -H "Content-Type: application/json" \
  -H "x-user-id: user-1" \
  -d '{"paymentToken":"tok_valid"}'
```

Declined mock payment (returns `402 PAYMENT_DECLINED` and leaves booking `pending`):

```bash
curl.exe -s -X POST http://localhost:3000/api/bookings/BOOKING_REF/pay \
  -H "Content-Type: application/json" \
  -H "x-user-id: user-1" \
  -d '{"paymentToken":"tok_decline"}'
```

## 9. Cancel an unpaid booking (Attendee)

```bash
curl.exe -s -X POST http://localhost:3000/api/bookings/BOOKING_REF/cancel \
  -H "x-user-id: user-1"
```

## 10. Unpublish an event (Organizer)

```bash
curl.exe -s -X POST http://localhost:3000/api/events/EVENT_ID/unpublish \
  -H "x-user-id: org-1"
```

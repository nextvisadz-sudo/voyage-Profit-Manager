---
name: H24Voyages API integration
description: Real API params, response shape, destination IDs, and known gotchas for the H24Voyages hotel search integration
---

## API Endpoint
`GET https://www.h24voyages.com/fr/hotels/api/Search/`

Required headers: `User-Agent: Mozilla/5.0 (Chrome)`, `Referer: https://www.h24voyages.com/fr/hotels/recherche`, `Accept: application/json`

## Query Parameters (exact names)
- `destinationId` — integer (NOT destination name)
- `arrDate` — DD/MM/YYYY format
- `depDate` — DD/MM/YYYY format
- `rooms` — number of rooms
- `adults1` — adults per room (repeat for rooms 2, 3…: `adults2`, etc.)
- `children1=0`, `infant1=0` — must be present

## Known Destination IDs
| ID | City | Country | Hotels |
|----|------|---------|--------|
| 8  | Tunis | Tunisie | 44 |
| 12 | Sousse | Tunisie | 40 |
| 13 | Djerba | Tunisie | 38 |
| 11 | Monastir | Tunisie | 26 |
| 14 | Mahdia | Tunisie | 11 |
| 20 | Tabarka | Tunisie | 9 |
| 15 | Gammarth | Tunisie | 4 |
| 7  | Nabeul | Tunisie | 3 |
| 90 | Hammamet | Tunisie | 2 |
| 16 | Zarzis | Tunisie | 2 |

IDs 1-6, 9-10, 17-19, 21-89, 91-500+ mostly return no hotels.

## Response Shape
- Top level: `{ hotels: RawHotel[], total, checkIn, checkOut, nights, currency: "DZD" }`
- Hotel: `hotelId (string), name, city, country, rating (stars 1-5), minRate (DZD integer), photos (string[]), review { rating: 0-20, count }, rooms[], address, marketingText, themes[]`
- Room: `{ name, amount (DZD), rates: [{ boardName, amount, cancellationPolicies[] }] }`
- Prices are in DZD — NO currency conversion needed

## Gotchas
- `review.count` can come as string for some hotels — always coerce `Number(raw.review.count)`
- `review.rating` is 0-20 scale, divide by 20 to get 0-1 or multiply by 5 for star-equivalent
- `facilities[]` is usually empty; use `themes[]` for amenity badges instead
- No hotel detail API endpoint exists (`/api/Hotel/Detail/` returns 500)
- Server-side 5-min in-memory cache is essential (API takes 3-5s per request)

**Why:** The API requires browser-like headers and rejects standard server requests without Referer. Response parsing must handle mixed string/number types.

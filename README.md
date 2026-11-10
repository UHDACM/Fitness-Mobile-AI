# ACM Fitness Mobile — Frontend

Mobile-first HTML, CSS, and JavaScript prototype for ACM Fitness. No build tools or package installation are required.

## Run locally

From this folder, run:

```sh
python3 -m http.server 8000
```

Open http://localhost:8000 and choose “Explore the demo.” The interface can be viewed with this server. Food search, barcode lookup, and plate analysis require a backend with the endpoints below. Camera access requires a supported browser and HTTPS (or localhost).

## Files

- `index.html` — app screens and navigation
- `styles.css` — responsive styling and themes
- `app.js` — navigation and prototype interactions
- `scan.js` — camera, food search, portion controls, and nutrition display
- `assets/acm-mark.png` — logo
- `zxing-browser.min.js` — barcode scanning library; see the included ZXing license files

## Backend integration

The frontend currently makes same-origin requests to:

- `GET /api/search?q=<food name>` — returns `{ "products": [{ "code": "...", "name": "...", "brand": "..." }] }`.
- `GET /api/food/<barcode>` — returns `{ "food": { ... } }`. The food object supplies `name`, `barcode`, `baseUnit` (`g` or `ml`), `servingAmount`, `servingText`, `packageAmount`, `packageText`, `gramsPerCup`, and `per100g` containing `calories`, `protein`, `carbs`, and `fat`. Amounts in `per100g` are per 100 g or per 100 mL according to `baseUnit`.
- `POST /api/plate` — accepts JSON `{ "image": "data:image/jpeg;base64,..." }` and returns `{ "foods": [{ "name": "...", "grams": 150, "confidence": "medium", "per100g": { "calories": 165, "protein": 31, "carbs": 0, "fat": 3.6 } }] }`.

Errors should use a non-success HTTP status and JSON `{ "error": "A message for the user" }`. These routes are relative to the frontend origin. If the backend is hosted separately, configure a reverse proxy or update the request URLs and configure CORS and authentication appropriately.

The live prototype's food lookup uses Open Food Facts. Plate analysis is not active until an AI service and server-side credentials are configured. Sign-in, food logging, workouts, and social features remain prototype screens; they need backend integration. Keep API keys and secrets on the backend, never in these files.

The current frontend can display missing nutrition fields as zero. The backend and frontend should be updated together to represent unknown nutrients as unavailable before relying on totals for production. Package and cup conversions depend on food-source data; validate them against labels.

## Third-party components

The bundled `@zxing/browser` barcode reader is distributed under the MIT license. Its underlying ZXing library is distributed under Apache License 2.0; see the included license files. Fonts are requested from Google Fonts when online. Review the terms and attribution requirements for any external food data provider used in production.

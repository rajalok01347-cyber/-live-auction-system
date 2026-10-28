# Local auction website

Open http://localhost:5173 . API and live bidding run on http://localhost:4001 .

## Demo accounts

All three accounts use the password `DemoAuction123!`.

| Role | Email |
| --- | --- |
| Bidder | bidder@example.test |
| Seller | seller@example.test |
| Admin | admin@example.test |

You can also sign up with your own test account. Use a separate browser or private window for the second bidder when trying live bidding.

## Restart after closing or rebooting

Right-click `start-local.ps1` and choose **Run with PowerShell**, or run `powershell -File .\start-local.ps1` from this folder. It starts the installed local backend and built frontend without showing terminal windows.

## Local adaptations

- MongoDB 7.0.14 runs locally on 127.0.0.1:27027, with persistent data in `server/local-data/database`. No Atlas account needed. Only the MongoDB executable and accompanying license notices were extracted from the official MongoDB Windows archive.
- The optional local entry point is `server/local/start.js`; the normal cloud-configured server entry point remains available.
- In local mode, image uploads go to `server/local-data/uploads` instead of Cloudinary. PNG, JPEG, GIF and WebP up to 5 MB are supported.
- Three sample listings and seller/bidder/admin accounts are seeded once. Listings initially last 24 hours. You can create more listings when they expire.
- The browser connects to the local API and Socket.IO server. A missing upstream UUID import was replaced with Node's built-in UUID generator.
- IP geolocation is skipped locally. Contact email delivery is not configured; a real Resend account is needed to use the contact form's email feature.
- English auction rules are implemented: sellers choose the minimum increment and exact start/end time. The first bid may equal the starting price; later bids must meet the current price plus increment. There is no arbitrary maximum raise.
- The deadline is fixed. No automatic extension is applied. Bids must be committed before the deadline according to database time. Equal concurrent bids accept one winner; competing requests that lose the race get a retry response.
- Every accepted bid and its history entry are written atomically. Both REST and Socket.IO use the same bidding service.
- A background closer runs every 500 ms, also on reads/bids. It permanently records winner and final price once and broadcasts the result. Empty auctions close with no winner or price.
- The frontend uses a synchronized server clock, ordered auction versions, reconnect snapshots and fallback polling. My Bids has Active / Won / Lost / All filters with server-side pagination.
- Existing listings without an increment retain a default increment of Rs 1. Your existing accounts, listings and bids are preserved.
- The updated backend runs on port 4001; the website address remains http://localhost:5173 .
- Frontend dependencies are installed, and a production build is served locally. To rebuild after editing: from `client`, run `node node_modules/vite/bin/vite.js build --configLoader runner`.

Keep `server/local-data` private: it contains your local database, uploaded images and local signing secret. The included `.gitignore` excludes it.

## Verification

From `server`, run `node --test tests/auction.test.js`. The six automated tests cover simultaneous equal and different bids, winner consistency and idempotent closing, self-bids, invalid amounts, minimum increments including decimal values, scheduled starts, last-second acceptance, late rejection, and empty closure. Tests use an isolated temporary database.

The local integration check also passed seller image upload/listing creation, two live viewers receiving the same state and final result, and Active/Won/Lost dashboard classification. The frontend production build passed. The updated dashboard, listing fields, live countdown and bid history were checked in the browser.

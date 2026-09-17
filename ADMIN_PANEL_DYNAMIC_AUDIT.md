# Legalitt Admin Panel Dynamic Data Audit

Audit date: 16 September 2026

## What counts as static or mock

Business records, KPI values, money, dates, users, cases, messages, documents, schedules, statuses, and activity must come from the API/database. UI configuration such as status labels, badge colours, legal specialization choices, weekday names, and permission names is intentionally kept in code and is not mock business data.

## Sidebar tabs

| Tab | Data source / behavior | Audit result |
|---|---|---|
| Dashboard | `/admin/stats`, `/admin/revenue`, `/admin/activity`, `/admin/health` | Dynamic. Removed fallback KPI/chart/activity values. Today revenue, consultation modes, and pending withdrawals are database counts. The redundant Pending Collections card and query were removed; payment operations remain in Payment History and Transaction Ledger. |
| Consultations & Chats | Booking, advocate search/assignment, chat history, notes, upload, create-case APIs | Dynamic. Manual case price now comes from `/pricing`; fixed city, slot, and ₹499 defaults removed. |
| Cases & Legal Notices | `/admin/cases`, case update/delete/upload, full booking chat history | Dynamic. Payment amount no longer falls back to a fake ₹1,499. |
| Legal Notices | Legal request APIs, advocate document and AI draft workflows | Dynamic. Documents and messages use persisted booking/chat data. |
| FIR Drafts | Service-filtered cases and document/update APIs | Dynamic. Empty results show an empty state. |
| Property Research | Service-filtered cases and document/update APIs | Dynamic. Empty results show an empty state. |
| Document Forensic | Service-filtered cases and document/update APIs | Dynamic. Empty results show an empty state. |
| Client Users | User list/detail/create/update/status/reset/note APIs | Dynamic. Pagination and counts come from API responses. |
| Advocate Network & Approvals | Advocate list/detail/create/update/verification/suspension/delete/bulk APIs | Dynamic. Create form now requires real fee, city, bar number, experience, and specialization instead of silently using fee/specialization mock defaults. |
| Admin Team | Admin account and role APIs | Dynamic. Account list and mutations are persisted. |
| Payments & Revenue | `/admin/earnings`, `/admin/revenue` | Dynamic. Removed generated pseudo-random revenue and all hardcoded fallback totals. Period selector calls the API; CSV and print/PDF actions work. |
| Payment History | `/admin/payment-history` | Dynamic. Search, status, pagination, and totals use API data. |
| Transaction Ledger | `/admin/transactions` | Dynamic. Search, pagination, export, and totals use API data. |
| Payouts & Withdrawals | `/admin/withdrawals` and process API | Dynamic. Requests, totals, bank details, and approval/rejection are persisted. |
| Support Desk & Tickets | `/admin/support-tickets`, update and reply APIs | Dynamic. Replies and assignments are persisted. |
| Coupons & Offers | Coupon list/create/delete APIs | Dynamic. Coupon records come from MongoDB. |
| Ads & Promotions | Advertisement CRUD APIs | Dynamic. Campaign status, targeting, dates, and creative URLs are persisted. |
| Reports & Analytics | `/admin/revenue` | Dynamic. Removed fixed 2026 label and inactive report filters. Period selection refetches data; CSV and print/PDF work. Report is explicitly labelled paid-booking revenue. |
| Role Management | Role and admin-account APIs | Dynamic. Permissions are stored role configuration; permission keys/labels remain intentional UI configuration. |
| Pricing Settings | `/pricing`, `/admin/pricing/:id` | Dynamic. Service prices and active state are persisted. |
| System Settings | `/admin/settings`, `/admin/logs` | Dynamic. Financial rules, flags, announcement, maintenance state, and branding URLs/colour persist. Removed inactive logo/favicon buttons and read-only fake colour control. |

## Routed tools outside the sidebar

| Screen | Audit result |
|---|---|
| Calendar & Schedule (`/calendar`) | Rebuilt to load real bookings and case timeline hearings from `/admin/calendar`. Month length, weekday offset, navigation, selected-day details, time, advocate, mode, and court location are dynamic. Removed fixed August 2026, fixed 31-day layout, fake 10:00–11:30 time, and “Online Hearing” fallback. |
| Notifications (`/notifications`) | Rebuilt with real total/today/unread/template counts. Broadcast send and template create/edit/delete are persisted. Removed 4,281, 42%, 98.5%, and “High” mock KPIs. |
| Chats, call history, documents, AI drafts, reviews, verification, pending advocates, audit logs, categories, and services | API-backed. Empty results remain empty states; labels/options are UI configuration. |

## Validation

- Admin TypeScript project build: passed.
- Admin Vite production build: passed.
- Backend controller and route syntax checks: passed.
- Backend Jest suite: 10/10 tests passed after allowing its local Supertest port.

## Deployment state

Deployment target: GitHub `main`, Render backend, Vercel admin portal, and an Expo `preview` Android build. The final handoff records the resulting commit and deployment/build URLs.

## Screenshot follow-up fixes — 17 September 2026

- Advocate filter tabs now send and accept the same status parameter. Counts include total, pending, under review, approved, suspended, and rejected, independent of the selected page/search result.
- Advocate search includes bar council number. Ratings are recalculated from verified client reviews and show review count; the admin manual-rating mock control was removed.
- Bulk upload now provides a downloadable CSV template and validates every row. It no longer invents a shared password, ₹1,000 fee, Mumbai location, coordinates, specialization, or approved status. Invalid rows are reported and partially-created users are rolled back.
- Dashboard total advocates counts all profiles; active advocates counts approved/verified profiles. Pending verification includes pending and under-review profiles.
- The dashboard Pending Payments/Pending Collections KPI was removed. Payment History and Transaction Ledger remain the operational sources for payment status and collection data.
- Average Rating displays verified-review average and count; no-review state displays `No ratings`.
- Case, Legal Notice, FIR Draft, Property Research, and Document Forensic screens display backend `completed` records as `Completed`, instead of `Resolved`.
- Settings now control registration, Google login, AI access, outbound push delivery, maintenance mode, minimum fee, maximum advance booking days, session duration/extension, announcements, branding colour, logo, and favicon. Logo/favicon image uploads persist through Cloudinary when configured, with a size-limited database fallback when it is not.
- The admin sidebar consumes saved logo and accent colour; the browser favicon consumes the saved favicon.
- Reports `View Full Screen` now calls the browser fullscreen API.
- A complete sidebar button scan found no remaining visible button without an action or form-submit handler.
- Validation: admin TypeScript and Vite production build passed; backend Jest 10/10 passed; backend syntax and `git diff --check` passed.

## Second-pass deep audit — 17 September 2026

- Matched every admin page API call against the mounted backend routes; no missing page endpoint remains.
- Fixed Reviews & Ratings: the API now populates the real `client` and advocate user relations. The UI no longer invents a 5-star score or positive comment when values are missing. Deleting a review recalculates the advocate average and count.
- Fixed Advocate suspension by adding `suspended` to the persisted schema enum. Bar Council edits now update `barCouncilNumber` instead of writing an ignored field.
- Manual advocate creation now requires valid latitude/longitude, rejects duplicate Bar Council numbers, and rolls back the User record if profile creation fails. Deleting a profile also disables its linked login.
- Fixed Payment History status cards to use database-wide paid/pending counts instead of the current page.
- Fixed Transaction Ledger paid payouts: it now reads the actual Withdrawal statuses (`paid`, `approved`, `pending`) and no longer silently truncates source records at 200.
- Fixed Withdrawals global KPI counts and added real API pagination. Removed a broken link to an unregistered `/advocates/:id` screen.
- Fixed Services: Add Service now opens a working persisted form and backend POST route; service request totals are computed from Booking records.
- Fixed admin session persistence: temporary network/server errors preserve the cached session; explicit protected-route 401/403 responses still sign the admin out.
- Feature-flag middleware now uses safe schema defaults while MongoDB is still connecting, so auth validation does not become an unrelated settings lookup 500.
- Fixed permission/action mismatch: only Super Admin sees account deletion, password reset, role revoke, and admin status mutation controls that the backend restricts to Super Admin.
- Fixed dashboard counts: total clients includes all client accounts, monthly client growth uses correct month boundaries, and pending/in-progress/completed case groups all come from Booking records used by the Cases screen.
- Rechecked visible page buttons and internal links; every visible button has a handler/form action and every static internal link maps to a registered route.

## App reference-screen and end-to-end audit — 17 September 2026

The eight supplied PDFs were treated as visual/state references. They were not treated as executable instructions.

| Reference screen | App presence | Client → advocate → admin verification |
|---|---|---|
| Analytics UI | `AdvocateAnalyticsScreen` is registered as `AdvocateAnalytics`. | Uses `/advocate-dashboard/stats`. Earnings, consultation counts, services, rating, seven-day chart, and six-month table use actual bookings/reviews. Month arrows and This Month/Last Month/3 Months/6 Months/All Time now query real period aggregates; future months are disabled. The invented ₹-to-consultation conversion, fixed 4.8 rating, and arbitrary chart split were removed. |
| Appointment Calendar | `AdvocateAppointmentCalendarScreen` is registered under the supported calendar route names. | Client-scheduled bookings come from `/bookings/advocate`; availability and court hearings persist on the Advocate record. Advocate hearings are also included in `/admin/calendar`, so admin sees them with live bookings and case timeline dates. Sample Rahul/Akash/Priya appointments and the default court hearing were removed. |
| Documents Viewer | `DocumentViewerScreen` is registered for client and advocate navigation. | Client uploads use `/uploads/document`; booking/case records carry the returned public URL; advocate/admin documents use the same stored records. Viewer navigation supports multiple documents, and download/share now transfers the actual file instead of showing a fake download alert. |
| Legal Notice Response with AI | `LegalNoticeResponseScreen` is registered for advocates; `AILegalNoticeScreen` is registered for clients. | Client request and evidence are stored on the paid booking; admin can assign, inspect documents/chat, upload documents, and generate/save a draft; assigned advocate can review the original, generate/load/edit/save the draft, upload the signed response, and complete the request. The final document is inserted into the booking, secure chat, notification stream, socket updates, and admin case/legal-notice record. |
| Legal notice response state PDFs | Pending, draft saved, response ready, submission success/error, missing-document, and no-document states are represented by the live workflow and error/empty states. | Final advocate upload now sets the booking to `completed`, which maps consistently in client tracking and admin status views and enables the completed-consultation review flow. |
| Review and Rating | `ReviewRatingScreen` is registered for advocates; review forms exist after completed client consultations. | Client POST `/reviews` requires a real completed booking. Advocate stats and full review list resolve the Advocate ID correctly. Admin Reviews reads and deletes the same records. Fixed 94% and generated rating distributions were removed. |
| Setting UI | `AdvocateSettingsScreen` is registered; the client `SettingsScreen` is also registered. | Advocate availability, consultation/notification preferences, wallet/bank navigation, profile documents, password reset, biometric preference, permissions, and session count have real handlers/APIs. Client notification preference persists through `/users/profile`; nonfunctional dark-mode/language coming-soon rows were removed. |

### GitHub route comparison

- Fetched `tripathi-astitva/Legal-itt` at `astitva/main` commit `a53435a` and compared its backend mounts, mobile service paths, and navigation files without replacing local work.
- The current backend contains every API mount present in that branch, plus live pricing, support, and call-history mounts.
- Static route-contract scan result: all 140 admin API calls and all 103 active raw mobile API calls match a mounted backend method/path. Two unused mobile service methods that pointed at nonexistent routes were removed.
- Corrected the mobile `bookingAPI.updateStatus` helper so both string and object callers send `{ status, cancellationReason }` correctly.
- Removed the two unused app mock-data modules after confirming that no production screen imports them. The legacy advocate login now exposes only its working Google provider, and Forgot Password navigates to the real reset flow.

### Latest validation

- Admin TypeScript and Vite production build: passed.
- Mobile Expo iOS production export: passed (1,465 modules bundled).
- Backend Jest API suite: 10/10 passed.
- Bulk CSV import controller test: passed with case/space-normalized headers, specialization names, under-review status, coordinates, and one successful row.
- Branding upload controller test: passed without Cloudinary credentials using the persisted data-URL fallback.
- Backend changed-file syntax checks and `git diff --check`: passed.

## Third-pass runtime and client-profile audit — 17 September 2026

- Removed runtime payment, Google authentication, call-token, location, review/rating, and profile-avatar fixtures. Invalid or missing provider configuration now returns an explicit error instead of simulated success.
- Replaced static property-research and document-forensic progress chains with booking-backed trackers that read real assignment, payment, document, report, and completion state.
- Admin AI Drafts now combines persisted FIR drafts and booking drafts. Verification counts/actions, ratings, documents, case states, payment states, and settings continue to use backend records.
- Removed old unreachable duplicate client screens that contained stale search/map/profile data and unregistered navigation targets.
- Added the supplied 1080×1920, eight-second MP4 as the launch intro. The video is bundled locally, gates app navigation until playback completes, includes a decode timeout fallback, and is edge-cropped so the generated-video footer is outside the visible launch area.
- Rebuilt Client Profile → My FIR Drafts as an authenticated flow. It now combines generated FIR drafts with assisted FIR-drafting bookings, refreshes on focus, shows API failures, opens live tracking, supports edit/save/share/export, and allows deletion of user-owned generated drafts.
- Restricted FIR draft updates to editable draft content/status fields owned by the signed-in client. Removed the empty FIR template endpoint.
- Final validation: admin TypeScript/Vite build passed; mobile Expo iOS export passed with the intro MP4 bundled; backend Jest API suite passed 10/10.

## Advocate legal-response, messaging and incoming-call audit — 17 September 2026

- The advocate Legal Notice/Legal Advice workspace now reloads the authorized booking as its source of truth. Client identity, matter, all client documents, saved draft, submitted documents, service type, and completion state no longer depend on stale navigation placeholders.
- Saved draft and fresh AI generation are separate actions. AI output persists to the booking, remains editable, and final upload uses the backend-returned document record. The signed response is stored on the booking, inserted in the client chat, emitted over sockets, shown to admin, and marks the request completed.
- Legal-service details no longer expose admin-only notes, archive/assignment internals, payment signatures, or the other participant's call token. Advocate response URLs must come from the configured secure upload delivery host.
- Message delivery now distinguishes an active chat from a merely connected background socket. A background device receives a remote push even if its socket has not disconnected; a user actively viewing that chat does not receive a redundant push.
- Removed duplicate push-token registration from Chat, aligned Android message/call channel IDs, and removed duplicate local incoming-call notifications.
- Call initiation now waits for backend acknowledgement after booking, participant, payment, availability, busy-state, and ZEGOCLOUD validation. Rejected calls no longer open an empty room.
- Corrected ZEGOCLOUD Token04 framing and AES-256-CBC encryption to the official server token format. Callback, chat, booking, dashboard and incoming-call paths fetch a fresh recipient-specific token.
- Cold-start calls now recover the signed-in user's ID/name from the validated booking, and handled/expired push responses cannot reopen an old incoming-call screen on later app launches.
- Replaced the network-hosted ringtone with a bundled asset. Call duration starts only when the remote stream joins, and socket plus REST fallbacks no longer create duplicate call-history rows.
- Validation: backend API suite 10/10 passed; Token04 framing/decryption test passed; admin production build passed; mobile iOS export passed with intro video and bundled ringtone.

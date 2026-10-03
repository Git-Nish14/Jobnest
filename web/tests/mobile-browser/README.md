# Mobile browser regression suite

Run `npm run test:mobile` from `web`. This starts a Vite fixture server on
`127.0.0.1:4173` and uses Playwright Chromium. On Windows, an installed Google
Chrome is detected automatically. Elsewhere install Chromium with
`npx playwright install chromium`, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE`.

For Safari-engine layout and interaction coverage, install WebKit with
`npx playwright install webkit`, then run `npm run test:mobile:webkit`. This
opt-in suite selects the application/form tests that use normal taps, selects,
keyboard input, and saves; it excludes the three CDP-specific application/form
gesture cases and the dedicated CDP control suite. Chromium still exercises the
real scroll gestures. WebKit results and reports use separate
`artifacts/webkit-results` and `artifacts/webkit-report` directories. A desktop
WebKit process with mobile emulation is not a physical iPhone Safari session.

The harness renders the real application header, cards, filters, board, form,
shared controls, touch guard, bottom navigation, and styles. A small fixture shell
replaces the authenticated layout; Next routing and the Supabase client use
in-memory substitutes. API requests are intercepted and external network requests
are rejected. No authentication bypass, preview route, real credentials, or
production database writes are involved.

Tests send actual Chrome DevTools touch input through the browser, including
touch start, movement, cancellation, and release. This catches dropdowns opening
on finger-down before a scroll begins; dispatching a synthetic click alone does
not reproduce that failure. The suite also checks normal taps, menu scrolling,
keyboard/mouse behavior, and the following user flows:

- Application list, filter sheet, manage sheet, and collapsed/expanded edit form
  at 320, 375, 430, and 767 px in light and dark themes, plus short landscape and
  desktop layouts; overflow, duplicate controls, focus, save reachability, and
  opaque navigation backing when backdrop blur is unavailable.
- Draft status cancellation, explicit save, failed save retention, and retry.
- Filter cancellation/apply, debounced search, pagination reset, and browser Back.
- Board view selection and horizontal swipes from cards and edit links.
- Native form status swipes, preserving collapsed values on save, revealing and
  focusing invalid fields, and creating an application with essential fields.
- Closing mobile sheets when resizing into the desktop layout.

Screenshots, failure traces, and the HTML report are written under ignored
`tests/mobile-browser/artifacts/`. This is component/browser coverage. It does
not replace authenticated end-to-end tests of Next routing, RLS, or real uploads.

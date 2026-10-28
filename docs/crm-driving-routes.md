# CRM driving routes

The CRM remains the existing static `/crm` page. Its optional **Optimize driving route** feature uses a server-side Vercel function to look up street addresses with Geocodio and optimize GPS points with Simple Routing's hosted VROOM API. It does not provide live traffic or guarantee the mathematically best route. The older **Auto-pick route** remains a local, approximate straight-line option for GPS coordinates only; manual ordering and Google Maps links are unchanged.

## One-time setup

1. Keep the Simple Routing API key private. Create a separate Geocodio account and key at <https://dash.geocod.io/apikey>. The default Geocodio key permissions for single/batch geocoding are sufficient; list, delete, and distance permissions are not needed. A Geocodio key is not needed for GPS-only routes.
2. In Vercel, open the **bandits-new-website** project, then **Settings → Environment Variables**. Create two project variables as **Secret** (write-only):
   - `SIMPLEROUTING_API_KEY` — the Simple Routing key.
   - `GEOCODIO_API_KEY` — the Geocodio key.
3. Select the appropriate **Preview** and/or **Production** environments. Use separate keys if your team's security policy requires them. Do not prefix them with `REACT_APP_`, put them in files, paste them into chat, or commit them to Git. They are read only by the Vercel function at runtime.
4. Deploy the new code after adding the variables. Vercel says environment-variable changes apply to **new** deployments, not existing ones. Do not deploy to production without the owner's approval.
5. Test in an isolated test environment with fictional records before relying on the feature. The normal preview uses the same Supabase project as the live CRM, so signing into it and saving jobs can affect live data; it is not an isolated test database. No real records were used by the automated tests.

## How to use it

1. Sign in, wait for **Synced across devices**, open **Route**, and select a date containing 2–100 scheduled or done jobs. Enter a start address or GPS location and optionally select **Return to start**. With no start, the currently first stop remains first; a return trip needs an explicit start.
2. Tap **Optimize driving route**. The first dialog explains what will be shared. Nothing is sent merely by opening it.
3. For street addresses, review the listed addresses and tap **Look up these locations**. The CRM sends a batch of only the distinct saved address strings to Geocodio. Anything entered in an address field is included, so keep names and gate codes in their separate fields instead. It does not automatically add a city; use complete addresses with city, state and ZIP.
4. Compare every saved address with the returned match and its location precision. The CRM warns about estimated or ambiguous matches and blocks unmatched, unknown, street-centroid, city-centroid, county-centroid, state-centroid, nearby-house, or intersection results. Correct those addresses or use GPS coordinates. Even rooftop matches can be wrong, so review them before continuing.
5. Tap **Matches look right — optimize**. For GPS-only routes, the first button instead sends the GPS points for optimization directly. Simple Routing receives coordinates, a numeric position for each job and the start/return setting—not customer names, phone numbers, job notes or CRM IDs.
6. Review the proposed order and tap **Save route order**. Only job ordering is changed; the CRM does not create or delete jobs or move them to another day. Leave the page open until it says **Synced across devices**. If the route changes while you are planning, close the dialog and start over. Reorder on only one device at a time: existing CRM sync sends record updates individually, not as a database transaction.
7. Use the existing Google Maps link or navigate to individual stops. Google Maps can omit waypoints on mobile browsers; the CRM warns about its link limits. Check the route before driving.

## Quotas, privacy and failures

- Simple Routing currently advertises 100 API **requests** per day on its free plan; one optimization sends one request containing multiple GPS stops. Other uses and retries share the account's quota and may count too. The CRM does not automatically retry provider calls.
- Geocodio advertises 2,500 free address **lookups** per day on its free plan. Each distinct address sent counts as a lookup; a duplicate within the same request is looked up once. The CRM does not persist a geocoding cache, so planning again uses more lookups. Verify the plan and limits in your accounts before use, particularly if either account has been upgraded to a paid plan.
- The starting location can also be a sensitive home or shop address. Geocodio receives street addresses; Simple Routing receives GPS coordinates that may also identify properties. Geocodio's security page says batch API request contents are not stored on its self-serve service, but provider policies can change. Review <https://www.geocod.io/security>, <https://www.geocod.io/data-retention-policy> and Simple Routing's own terms before use.
- Provider credentials are sent in server-to-server Authorization headers, never in the browser or URLs. The browser sends a Supabase user access token over the same-origin request; the function verifies it against the existing Supabase project's Auth user endpoint and rejects anonymous or invalid sessions. It uses the existing publishable project key, not a Supabase service-role key. Any signed-in CRM team member has the same routing capability, consistent with existing CRM access.
- Missing keys, unavailable services, quota limits, invalid input, unmatched/coarse locations, incomplete/unassigned routes, and changed route snapshots leave job order untouched. The function does not log request bodies or provider keys. Infrastructure and providers may maintain their own operational logs.
- The live provider integration has not been verified until real keys are configured and an authorized user completes a safe end-to-end test. The automated tests use fakes and must not be represented as a live-provider test.

Provider documentation: <https://www.simplerouting.io/vrp-solver-api/>, <https://www.simplerouting.io/geocoding-api/>, <https://www.geocod.io/docs/#batch-geocoding>, <https://www.geocod.io/free-geocoding>, <https://vercel.com/docs/environment-variables/sensitive-environment-variables>.

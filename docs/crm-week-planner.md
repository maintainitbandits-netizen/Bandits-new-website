# CRM workweek planner

The existing vanilla `/crm` has an optional **Plan workweek** button. It suggests workdays for a pasted list of addresses or a plain-text `.txt` file, then proposes a road-network order for the **new stops on each day**. The suggestion is not a guarantee of the best route, a work-hours estimate, or a live-traffic prediction. It uses the same authenticated `/api/crm-route` function, Geocodio, and Simple Routing keys as the existing daily driving-route feature; no additional keys or database tables are required.

## Planning a week

1. Sign in and wait for **Synced across devices**. Tap **Plan workweek**, choose the Monday starting the week, and select the days on which you can work. By default, Sunday and Saturday open the following week; on weekdays the default excludes days already past. Selected workdays cannot be in the past.
2. Choose an existing default client or explicitly choose to create a client for each distinct address, and choose a service. Paste one **complete address with city, state, and ZIP** or GPS pair per line, or upload a `.txt` file under 1 MB. This planner does not read PDF, images, Excel, or CSV. It imports only location and an optional date requirement—not other work-order details, names, phone numbers, prices, or notes. Each line becomes a separate one-time job with no price set. You can change the client and service for an individual job in the next step.
3. A job without a date requirement can be suggested for any selected workday in that week. Open an individual job to choose **Due by a date** or **Must be on a date**. Optionally add a suffix directly in the text file:

   ```text
   100 Fictional St, Austin, TX 78701
   200 Fictional St, Austin, TX 78701 | due 2026-11-06
   300 Fictional St, Austin, TX 78701 | exact 2026-11-04
   ```

   Use `YYYY-MM-DD`. A due-by job can be scheduled on or before its date; an exact job must be on that date. If no selected workday satisfies a requirement, or a day would exceed the 100-stop combined limit, the planner identifies the affected jobs and does not send the addresses or save a partial plan. Change the dates, select different workdays, or split the list into smaller batches.
4. Review the sharing disclosure before continuing. Distinct street addresses—including an optional street-address start—are sent to Geocodio in batches, only after confirmation. Duplicate addresses share a lookup, but **each line remains a separate job**. Review every returned match; unmatched and coarse matches block planning. The CRM warns about ambiguous and estimated matches. A precise-looking match can still be wrong.
5. After confirming the matches, the planner groups the jobs approximately by geographic proximity and total stop count, then sends GPS points and an optional start point to Simple Routing to order each day's **new** stops. It makes one Simple Routing request for each day with at least two new stops; moving jobs and re-optimizing uses additional requests. Without a start, the first new stop for that day stays first. No client names, phone numbers, job notes, required dates, or CRM IDs are sent to the routing provider, but anything entered in a location field is included in the address lookup. Coordinates can also identify properties. GPS-only lists skip Geocodio.
6. Review every proposed day and move jobs among eligible workdays if needed. Re-optimize changed days before saving. **Existing scheduled/done stops count toward the suggested workload and the 100-stop limit, but are not included in these optimized lists and are not moved or reordered.** New stops are appended after existing stops on the saved day; for a driving order across both existing and new stops, open that day's **Route → Optimize driving route** after saving and review it separately.
7. Possible duplicate jobs in the batch or existing week, and new-client addresses already listed for a client, are flagged but not automatically removed: two work orders may legitimately share an address. The check uses normalized text/GPS and may miss different street abbreviations. Review duplicates carefully. Tap **Save all jobs** and confirm only when the whole week is correct. The confirmation reports how many new clients will also be added. No records are created before this final step. Leave the page open until it says **Synced across devices**, then verify the plan on the other phone.

The split uses **number of stops**, not job durations, staff availability, break times, actual driving time between different days, or live traffic. It may suggest too much work for a day even below 100 stops. Check capacity and change the proposed days before saving.

After saving, **Route → Pick addresses to route** can create a temporary driving route for selected scheduled jobs, including jobs from other dates. It does not move or reschedule them and does not save or sync the temporary route; see [CRM driving routes](crm-driving-routes.md#route-only-the-addresses-you-pick).

## Stored requirements and safety

- A saved job keeps its due-by or exact-day requirement. It appears on Route/Jobs, and the quick Route control will not move it to an incompatible date. Edit the job to intentionally change its requirement. Flexible jobs have no hard requirement after saving and may later be moved outside the original planning week.
- Refresh the CRM on every device after deploying this update. An older page that is still open does not know about the new date requirements and cannot enforce them.
- Requirements apply to one occurrence. If a job is later made recurring, the automatically spawned next occurrence does not inherit its previous required date.
- The planner adds scheduled jobs and, only when selected, new clients named by their addresses. Repeated new-client addresses share one newly created client while retaining separate jobs. It does not delete or move old records or reorder old stops. It checks that relevant CRM records have not changed before and during provider requests and again before saving. A change requires another review.
- Potential duplicates are warnings, not idempotency protection. Do not save the same list twice. Import and plan from one device at a time. The CRM's outbox sends individual records, not an atomic database transaction; simultaneous edits on different devices can still race. Keep a private backup first. JSON backups do **not** include photo files.
- Up to 1,000 input lines may be reviewed, but a selected day is limited to 100 total existing and new stops. There can be fewer than 700 assignable new stops in a seven-day week if existing stops use capacity. The planner refuses a partial save if a requirement or capacity leaves a job unassigned.
- Geocodio advertises 2,500 free address lookups per day, and Simple Routing advertises 100 free requests per day, counted per request rather than per stop. Provider terms and account plans can change. Retries and requests made elsewhere may count; the CRM does not silently retry provider calls. No provider keys are sent to the browser.

## Tests and deployment

`tests/test_crm_week_plan.cjs` tests parsing, dates, requirements, balancing, grouping, batching and route capacity. `tests/test_crm_sync.cjs` exercises fictional multi-device sync, stale snapshots and failure cases. `tests/test_crm_week_mobile.cjs` tests fictional flows at phone widths with all network requests intercepted. These are simulations, not proof that production accounts and two real phones work together.

A Vercel preview uses the same Supabase project as the live CRM. Reviewing a proposed plan does not save jobs, but clicking **Save all jobs** in that preview will add real records. Before relying on the feature, test with a small fictional list without saving, then separately confirm an intentional save and two-phone sync. Do not publish without owner approval.

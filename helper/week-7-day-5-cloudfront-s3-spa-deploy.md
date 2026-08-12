🕐 Last Updated: 2026-07-22 21:13:28 UTC
📌 Commit: 8ab25c6c
Week 7 · Day 5
CloudFront & S3 SPA Deploy
Take the last layer off the laptop — serve the Module 5 React SPA from a private S3 bucket behind CloudFront with OAC and tiered caching, wire it to the deployed API with CORS and the bearer-token flow, add a cache-invalidation hook on deploy, and re-run the Module 5 Playwright, axe, and Lighthouse gates against the live CloudFront URL for the weekly demo.

1
Topic 1 of 5
Serving the SPA from S3 behind CloudFront
Why Do I Need to Know This?
The backend is on AWS compute after 7.3 ECS Fargate & ALB and 7.4 Lambda & API Gateway, but the front end still runs from a dev server on someone’s laptop. A React SPA is just static files, and the federal-appropriate way to serve them is a private S3 bucket behind CloudFront — never a public bucket. This lesson answers why CloudFront and S3 are the federal-appropriate way to serve it. No new SPA code is written in this lesson; the Module 5 build artifacts are deployed as-is.

Scenario
The Module 5 React SPA — the one that passed the Sprint 3 UI gate — currently runs from npm run dev on a laptop. The team must serve its built dist/ from S3 through CloudFront so it has a real, cacheable, private-origin URL, without changing a line of the SPA.

Theory
Static files in a private bucket, served by CloudFront
A built SPA is static JavaScript, CSS, and HTML. Those files go into a private S3 bucket — one with no public access — and CloudFront is the only thing allowed to read them. Users hit the CloudFront URL; CloudFront fetches from the bucket and caches at the edge. The bucket itself is never reachable from the internet, which is the posture an auditor expects.

Origin Access Control locks the bucket to CloudFront
Origin Access Control (OAC) is how CloudFront reads a private bucket. OAC signs CloudFront’s requests to S3 with SigV4 and includes the distribution’s identity, so the bucket policy can allow only this distribution and nothing else. AWS recommends OAC over the older Origin Access Identity (OAI) for new work — OAC scopes access per distribution and supports SSE-KMS encryption, neither of which OAI does well.

Cache behaviors and SPA routing
CloudFront cache behaviors apply different rules per path pattern. The two that matter for an SPA: long-cache the fingerprinted assets (covered in the Cache-Control and the invalidation strategy on deploy topic) and serve index.html with little or no caching. Because an SPA does its own client-side routing, a request for a path like /filings/42 is not a real file in S3 — CloudFront is configured to return index.html for those, and the SPA’s router takes over from there.

i
Note
LocalStack emulates CloudFront and S3, so the team can stand this up locally, but edge-cache and invalidation behaviors are only approximate. Use LocalStack to wire and dry-run the deploy; the binding behavior — real edge caching and the live accessibility run — is confirmed on real AWS in Module 8. Note that CloudFront is emulated only on LocalStack’s Base tier or higher, not the free plan, so this exercise requires the cohort’s licensed paid LocalStack plan.

The browser reaches a private bucket only through CloudFront
CloudFront serves the SPA from edge caches and reads the private bucket via OAC; the bucket is never reached directly.

Browser

CloudFront (cache behaviors)

OAC (SigV4 signed request)

Private S3 bucket (SPA build)

Example
a cloudfront distribution over a private bucket
{
  "Origins": [{
    "DomainName": "filing-spa.s3.amazonaws.com",
    "OriginAccessControlId": "oac-filing-spa",          // (1) OAC, not a public bucket
    "S3OriginConfig": {}
  }],
  "DefaultCacheBehavior": {
    "TargetOriginId": "filing-spa",
    "ViewerProtocolPolicy": "redirect-to-https"
  },
  "CacheBehaviors": [{
    "PathPattern": "/index.html",                       // (2) index.html: its own behavior
    "TargetOriginId": "filing-spa"
  }],
  "CustomErrorResponses": [{
    "ErrorCode": 403,                                    // (3) SPA routing fallback
    "ResponseCode": 200,
    "ResponsePagePath": "/index.html"
  }]
}
Copy
Annotation (1) — the origin is read through OAC, so the bucket stays private and only this distribution can fetch from it.
Annotation (2) — index.html gets its own cache behavior so it can be served fresh while assets are cached long (the Cache-Control and the invalidation strategy on deploy topic sets the actual Cache-Control).
Annotation (3) — mapping a missing-path error back to index.html is how client-side routes like /filings/42 resolve to the SPA, which then renders the route.
AI Practice
Prompt it
Have Codex set up the CloudFront distribution and private bucket, then verify the bucket is not public.

Set up CloudFront over a private S3 bucket for our Module 5 SPA build: create the
bucket with all public access blocked, an Origin Access Control so only this
distribution can read it, a default behavior that redirects to HTTPS, and a routing
fallback that serves index.html for client-side routes. Do not enable S3 static
website hosting or any public bucket policy. We deploy to LocalStack first.
Copy
Watch out
Codex frequently enables S3 static website hosting and a public bucket policy (the old pattern), which exposes the bucket directly, or uses the deprecated OAI instead of OAC. It may forget the SPA routing fallback, so deep links 404. Confirm the bucket blocks all public access, OAC is used, and client-side routes fall back to index.html.

Verify
Confirm the bucket has all public access blocked and is readable only via the CloudFront distribution (OAC), not directly. Load the CloudFront URL and confirm the SPA renders. Navigate to a deep client-side route and confirm it resolves to the SPA rather than a 404. Because LocalStack’s CloudFront is approximate, repeat the edge checks on real AWS in Module 8. Record any public bucket or OAI usage in your prompt journal.

Knowledge Check
1. How should the SPA’s static files be served for a federal site?
From a public S3 bucket with static website hosting turned on.
From a private S3 bucket that only CloudFront can read.
Directly from the developer’s laptop through a shared tunnel.
From the API server, which streams each static file on request.
2. What does Origin Access Control (OAC) do?
It caches the SPA at edge locations physically closer to users.
It rewrites SPA routes to index.html for client-side routing.
It compresses the assets before CloudFront serves them to clients.
It lets only CloudFront read the otherwise-private bucket.
3. Why is OAC preferred over the older OAI?
It scopes access per distribution and supports SSE-KMS.
It is the only mechanism that works with S3 static website hosting.
It removes the need for any bucket policy whatsoever.
It lets the browser fetch the SPA without going through CloudFront.
4. How are SPA client-side routes (like /filings/42) handled at CloudFront and S3?
Each route is uploaded to the bucket as its own separate object.
The API server renders each route and returns the HTML for it.
Route requests fall back to index.html for the SPA.
CloudFront rejects any path that is not a real file in the bucket.
2
Topic 2 of 5
Connecting the SPA to the deployed API — CORS and the bearer-token flow
Why Do I Need to Know This?
The deployed SPA must call the deployed API — the Fargate service from 7.3 ECS Fargate & ALB and the Lambda route from 7.4 Lambda & API Gateway — which now live at a different origin than the CloudFront URL. So the CORS rules and the bearer-token auth that worked against localhost have to be made correct for the deployed topology, or every API call fails in the browser.

Scenario
With the SPA on a CloudFront URL and the API on its AWS URL, the browser blocks the first API call with a CORS error, and the auth token is not reaching the API. The team fixes both for the deployed origins, still without changing the SPA’s logic — only its configuration.

Theory
CORS: the API must allow the CloudFront origin
A browser blocks a cross-origin request unless the server explicitly allows it. The deployed API must return CORS headers naming the SPA’s CloudFront origin in Access-Control-Allow-Origin, the methods it permits, and the headers it accepts — including the Authorization header. For non-simple requests the browser first sends a preflight OPTIONS request, which the API must answer with those same allow headers before the real request is sent.

The bearer-token flow across origins
The SPA authenticates by attaching the bearer token (from the Module 3 auth work) in the Authorization: Bearer <token> header. Across origins, two things must hold: CORS must list Authorization among allowed headers (or the browser strips the preflight), and the SPA must still attach the token on every request to the new API_BASE_URL — nothing about deployment changes how or when the token is sent. The auth design does not change — only the origins it runs between.

Configuration, not new SPA code
Pointing the SPA at the deployed API is a configuration change: the SPA’s API base URL switches from localhost to the deployed API URL via build-time or runtime config. No component or routing code changes — the Sprint 3 UI gate already validated the SPA’s behavior, and this lesson does not touch it.

!
Warning
Do not "fix" CORS by allowing * or disabling it. A wildcard origin with credentialed requests is both rejected by browsers and a security problem. Allow the specific CloudFront origin and the exact methods and headers the SPA uses, including Authorization.

Preflight, then the authenticated cross-origin request
The browser preflights the cross-origin call; once the API allows the origin and headers, the SPA sends the real request with its bearer token.

Deployed API
Browser (SPA on CloudFront)
Preflight OPTIONS (cross-origin)
1
Allow-Origin, allowed methods and headers
2
Request with Authorization Bearer token
3
Verified response
4
Example
api cors config and the spa's authenticated fetch
// On the deployed API — allow the SPA's CloudFront origin
const corsOptions = {
  origin: "https://d1234.cloudfront.net",   // (1) the SPA's exact origin, not "*"
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"],  // (2) Authorization must be allowed
};

// In the SPA — attach the bearer token (no logic change, just the base URL)
await fetch(`${API_BASE_URL}/filings`, {        // (3) API_BASE_URL is config, now the deployed API
  headers: { Authorization: `Bearer ${token}` }, // (4) the same auth flow from Module 3
});
Copy
Annotation (1) — the API allows the SPA’s specific CloudFront origin, never *, so credentialed requests are accepted safely.
Annotation (2) — Authorization is in the allowed headers, so the browser does not strip it during preflight.
Annotation (3) — only API_BASE_URL changes (config), from localhost to the deployed API; the fetch code is unchanged.
Annotation (4) — the bearer token is attached exactly as in the Module 3 auth design; deployment did not change how auth works.
AI Practice
Prompt it
Have Codex configure CORS for the deployed origins, then verify an authenticated cross-origin call succeeds.

Configure CORS on our deployed API to allow our SPA's CloudFront origin: set
Access-Control-Allow-Origin to that specific origin (not *), allow GET and POST,
and include Authorization in the allowed headers so the bearer token is accepted.
Then point the SPA's API base URL at the deployed API via config without changing
any component code. Show the CORS config and the base-URL change.
Copy
Watch out
Codex often sets Access-Control-Allow-Origin: *, which breaks credentialed requests and is insecure, or forgets to allow the Authorization header so the token is stripped at preflight. It may also edit SPA component code instead of just the base-URL config. Confirm the origin is the specific CloudFront URL, Authorization is allowed, and only configuration changed.

Verify
From the deployed SPA, make an authenticated API call and confirm the preflight passes and the bearer token reaches the API. Confirm Access-Control-Allow-Origin names the CloudFront origin, not *, and that only the API base URL changed in the SPA. Record any wildcard origin or stripped Authorization header in your prompt journal.

Knowledge Check
1. The deployed SPA’s first API call is blocked by a CORS error. Why?
The API doesn’t allow the SPA’s CloudFront origin yet.
The SPA was built with the wrong JavaScript framework version.
CloudFront strips all API responses before the browser can see them.
The bucket policy forbids the browser from loading the SPA at all.
2. What must the deployed API return for the SPA’s cross-origin requests to work?
A redirect to the API’s own domain for every request.
A copy of the SPA’s index.html in each response body.
Allow-Origin set to the CloudFront URL, with allowed headers.
A disabled CORS setting so the browser skips all of its checks.
3. How does the deployed SPA authenticate its API requests?
CloudFront injects the credentials into every API request automatically.
It attaches the bearer token to the Authorization header.
The API trusts any request that arrives from the CloudFront URL.
Auth is skipped because the SPA and API now share one origin.
4. Pointing the SPA at the deployed API means changing what?
The SPA’s component code and routing logic must be rewritten for it.
The API must be redeployed to match the SPA’s old localhost URL.
Nothing — the SPA discovers the API automatically by service discovery.
The SPA’s API base URL, via build or runtime config.
3
Topic 3 of 5
Cache-Control and the invalidation strategy on deploy
Why Do I Need to Know This?
A CDN that caches index.html will keep serving the old app after a deploy — users get stale code pointing at assets that may have changed. The team needs a caching strategy that lets assets cache for a long time while the entry point stays fresh, plus an invalidation hook so every deploy is visible immediately. Get this wrong and a deploy silently does nothing for already-cached users.

Scenario
After deploying a new SPA build, users still load the old version because CloudFront cached index.html. The team adds a per-file-type Cache-Control strategy and a deploy-time invalidation so the new version is served the moment it ships.

Theory
Fingerprinted assets are immutable — cache them for a year
A production SPA build emits fingerprinted asset filenames like app.a1b2c3.js, where the hash changes whenever the content changes. Because a given filename’s content never changes, those assets can be cached essentially forever — Cache-Control: max-age=31536000, immutable.

index.html must stay fresh
index.html is the entry point that references the current fingerprinted assets, so it must not be cached long — serve it no-cache or with a very short TTL. When a new build deploys, a fresh index.html points at the new asset filenames, and the browser pulls those new assets because their names changed. The tiered strategy — long-cache assets, no-cache entry point — is the standard SPA pattern.

Invalidate the entry point on deploy
Even with a short TTL, the safe move on deploy is to invalidate index.html explicitly with aws cloudfront create-invalidation so the new version is served immediately rather than after the TTL expires. Invalidating /index.html (or /*) costs one path; the first 1,000 paths per month are free, so a deploy-time invalidation is effectively free. The fingerprinted assets need no invalidation because their names already changed.

!
Important
A deploy that does not invalidate the entry point can be invisible. If index.html is cached and not invalidated, already-cached users keep loading the old app and never see the new assets. Pair long-cache assets with a fresh, invalidated index.html so every deploy takes effect at once.

Upload everything, cache assets long, invalidate the entry point
A deploy uploads new fingerprinted assets and a fresh index.html; assets cache for a year, and invalidating index.html makes the new version visible immediately.

Deploy new build

Upload assets + index.html to S3

Assets: Cache-Control max-age 1 year, immutable

Invalidate /index.html

CloudFront serves the new version at once

Example
a deploy script with per-type cache-control and invalidation
# (1) upload fingerprinted assets with a long, immutable cache
aws s3 sync dist/ s3://filing-spa/ \
  --exclude index.html \
  --cache-control "max-age=31536000, immutable"

# (2) upload index.html with no-cache so the entry point stays fresh
aws s3 cp dist/index.html s3://filing-spa/index.html \
  --cache-control "no-cache"

# (3) invalidate the entry point so the new version is served immediately
aws cloudfront create-invalidation \
  --distribution-id E123 --paths "/index.html"
Copy
Annotation (1) — every asset except index.html is uploaded with a one-year immutable cache; their fingerprinted names make this safe.
Annotation (2) — index.html is uploaded no-cache, so the browser always revalidates the entry point that names the current assets.
Annotation (3) — invalidating /index.html forces CloudFront to drop its cached copy at once; that one path is within the free monthly allowance.
AI Practice
Prompt it
Have Codex write the deploy script with the tiered cache strategy, then verify a deploy is visible immediately.

Write a deploy script for our SPA: aws s3 sync the dist/ assets (everything except
index.html) with Cache-Control max-age=31536000, immutable; upload index.html with
Cache-Control no-cache; then create a CloudFront invalidation for /index.html. Show
the script and explain why the fingerprinted assets do not need invalidation.
Copy
Watch out
Codex often applies one Cache-Control to all files (caching index.html long, so deploys go unseen), or invalidates /* on every deploy out of caution (needless cost and slower) instead of just the entry point. It may also forget the invalidation entirely. Confirm assets are long-cached and immutable, index.html is no-cache, and the deploy invalidates the entry point.

Verify
Deploy a change and confirm the new version loads immediately at the CloudFront URL, not after a delay. Confirm fingerprinted assets carry max-age=31536000, immutable and index.html is no-cache. Confirm the deploy invalidates /index.html and does not needlessly invalidate every asset. Because LocalStack’s caching is approximate, re-confirm the deploy-then-reload behavior on real AWS in Module 8. Record any single-Cache-Control mistake in your prompt journal.

Knowledge Check
1. Why can fingerprinted assets be cached for a year?
Because CloudFront ignores Cache-Control on hashed filenames anyway.
Because the browser re-downloads them on every page load regardless.
Their filename changes with content, so the cache stays safe.
Because assets under one megabyte are never cached by CloudFront.
2. Why must index.html be served no-cache (or with a very short TTL)?
It names the current fingerprinted assets, so it must stay fresh.
It contains the user’s auth token and must therefore never be cached.
It is too large for CloudFront to cache at the edge locations.
It changes on every single request, so caching would corrupt it.
3. When is a CloudFront invalidation needed on deploy?
For the fingerprinted assets, since their cache never expires.
For every object in the bucket, on every single deploy made.
Never — CloudFront detects new uploads and refreshes on its own.
For index.html, so the new version is served at once.
4. What does aws cloudfront create-invalidation on /* cost in path terms?
One path for each file currently cached in the distribution.
A single path, so invalidating everything is cheap.
It is billed per byte of cached content that gets removed.
Nothing — CloudFront invalidations are always completely free.
4
Topic 4 of 5
Wiring the accessibility and end-to-end gates into CD, and the weekly demo
Why Do I Need to Know This?
The Module 5 Playwright, axe, and Lighthouse jobs proved the SPA was accessible and working locally. Deployment can break what passed locally — a wrong API base URL, a CORS block, a stale cache. Re-running those gates against the live CloudFront URL is the proof the deployed app still meets the bar, and it is this module’s weekly demo. The weekly demo is not the Sprint 5 gate — that gate, the real-AWS deploy, is Module 8.

Scenario
The team’s CI accessibility and end-to-end jobs pass locally but have never run against a deployed URL. For the weekly demo, they extend those jobs to also target the CloudFront URL and re-run them green end-to-end, then demo the SPA served from CloudFront calling the deployed API.

Theory
Reuse the Module 5 jobs, retargeted at the deployed URL
The same jobs from the Sprint 3 UI gate — Playwright for end-to-end flows, axe for accessibility violations, Lighthouse for the accessibility score — are pointed at the deployed CloudFront URL instead of localhost. This is reuse, not a rewrite: the test base URL changes, and the existing suites run against the live deployment.

What deployment-specific failures these catch
Running the gates against the deployed URL catches problems that only exist after deploy and never show up locally: a wrong API base URL, a CORS block on the live origins, a stale CDN cache serving an old build, or a missing asset. These are exactly the failure modes the previous three topics guard against, and the gates confirm the guards held in the deployed environment.

The bar is the same, and this is a demo
The deployed SPA must still meet the Module 5 standard — a Lighthouse accessibility score of at least 90 — now against the live URL. Meeting it is the week’s exit proof and the content of the weekly demo: the SPA renders and passes the gates served from CloudFront, calling the deployed API. The Sprint 5 gate, where the whole system deploys to real AWS via Terraform (infrastructure-as-code), comes in Module 8.

The CD path from deploy to demo
A deploy invalidates the entry point, runs the Module 5 gates against the CloudFront URL, and a green run feeds the weekly demo.

pass

fail

Deploy SPA to S3 and CloudFront

Invalidate index.html

Run Playwright, axe, Lighthouse vs the CloudFront URL

Weekly demo

Fix and redeploy

Example
re-pointing the gates at the deployed url
// playwright.config.ts — only the base URL changes from localhost to the CloudFront URL
export default defineConfig({
  use: {
    baseURL: process.env.DEPLOY_URL ?? "http://localhost:5173",  // (1) deployed CloudFront URL in CD
  },
});

// CI step — run the existing Module 5 suites against the deployed URL
//   DEPLOY_URL=https://d1234.cloudfront.net npx playwright test   // (2) e2e + axe
//   lhci autorun --collect.url=$DEPLOY_URL                        // (3) Lighthouse a11y >= 90
Copy
Annotation (1) — the only change is the baseURL; in CD it points at the deployed CloudFront URL, so the same tests exercise the live deployment.
Annotation (2) — the existing Playwright and axe suites run unchanged against the deployed URL, catching CORS, base-URL, and cache problems that never appear locally.
Annotation (3) — Lighthouse runs against the deployed URL and must still meet the Module 5 accessibility bar of at least 90.
AI Practice
Prompt it
Have Codex wire the Module 5 gates into CD against the deployed URL, then verify they target CloudFront and still pass.

Extend our Module 5 CI jobs to also run against the deployed SPA: parameterize the
Playwright baseURL so CD points it at the CloudFront URL, and run the existing axe
and Lighthouse jobs against that URL too, keeping the Lighthouse accessibility
threshold at 90. Do not rewrite the test suites — only retarget them. Show the
config change and the CI steps.
Copy
Watch out
Codex sometimes writes new test suites instead of retargeting the existing ones, hard-codes a single URL so the jobs cannot switch between local and deployed, or quietly lowers the Lighthouse threshold to make a deployed run pass. Confirm the existing suites are reused, the base URL is parameterized, and the 90 accessibility threshold is unchanged.

Verify
Run the gates against the deployed CloudFront URL and confirm Playwright e2e flows pass, axe reports no critical violations, and Lighthouse accessibility is at least 90. Confirm these are the Module 5 suites retargeted, not new ones, and the threshold was not lowered. Confirm the run exercises the live SPA calling the deployed API. Record any new-suite or lowered-threshold shortcut in your prompt journal.

Knowledge Check
1. Why re-run the Module 5 Playwright, axe, and Lighthouse jobs against the deployed URL?
Because the deployed URL needs an entirely new accessibility test suite.
Because CloudFront refuses to serve a site that has not been tested.
Because the jobs simply run faster against a remote URL than locally.
Deployment can break what passed locally — URL, CORS, or caching.
2. What do the re-run gates point at instead of localhost?
A staging copy of the SPA bundled inside the test runner itself.
The deployed CloudFront URL, set as the test base URL.
The S3 bucket’s direct object URL, bypassing CloudFront entirely.
A mock server that returns canned accessibility results for speed.
3. What Lighthouse accessibility threshold must the deployed SPA still meet?
Any score, as long as the page renders at the CloudFront URL.
A perfect 1.0, with zero warnings of any kind permitted.
The same Module 5 bar — at least 90.
No threshold at all; Lighthouse only runs on local builds.
4. What is the milestone at the close of this lesson?
A weekly demo of the SPA on CloudFront, not a sprint gate.
The Sprint 5 gate, where the capstone deploys to real AWS.
A code freeze with no demo until Module 8 finally begins.
The final capstone presentation delivered to the customer panel.
5
Topic 5 of 5
Practice — deploy the SPA, wire it up, and run the weekly demo
Why Do I Need to Know This?
This lesson’s payoff — and the module’s — is the whole capstone off the laptop: the Module 5 SPA served from a private S3 bucket behind CloudFront, calling the deployed API with CORS and the bearer token, with a tiered cache and a deploy-time invalidation, and the Module 5 accessibility and end-to-end gates re-run green against the live CloudFront URL for the weekly demo. The way to know you have it is to deploy with Codex and then attack it — confirm the bucket is private, a deploy is visible immediately, an authenticated cross-origin call succeeds, and the gates pass against the deployed URL. The same definitions deploy to real AWS with Terraform in Module 8.

AI Practice
Prompt it
Hands-on practice for this lesson — deploy the SPA end to end on LocalStack with Codex, then break each guarantee.

Deploy our Module 5 SPA on LocalStack end to end: (1) a private S3 bucket behind
CloudFront with OAC and a routing fallback to index.html; (2) CORS on the deployed
API allowing the CloudFront origin and the Authorization header, with the SPA's API
base URL set by config; (3) a deploy script that long-caches fingerprinted assets,
serves index.html no-cache, and invalidates /index.html; (4) the Module 5
Playwright, axe, and Lighthouse jobs retargeted at the CloudFront URL with the 90
accessibility threshold. Show the distribution, the CORS config, the deploy script,
and the CI steps.
Copy
Watch out
Codex is likely to make the bucket public or use OAI, set CORS to * or drop the Authorization header, apply one Cache-Control to everything (so deploys go unseen) or skip the invalidation, write new test suites instead of retargeting, and quietly lower the 90 threshold. Each may still "work" on LocalStack while breaking a guarantee. Read the bucket access, the CORS origin and headers, the per-type cache and invalidation, and the reused suites and threshold before trusting it.

Verify
Confirm the bucket blocks public access and is readable only via CloudFront (OAC). Deploy a change and confirm it loads immediately at the CloudFront URL. Make an authenticated cross-origin API call and confirm preflight passes and the bearer token reaches the API. Run the retargeted Module 5 gates and confirm Playwright passes, axe is clean, and Lighthouse accessibility is at least 90. Because LocalStack’s CloudFront is approximate, list the edge-cache and live-URL checks to repeat on real AWS in Module 8. Record every guarantee that failed on the first pass in your prompt journal.


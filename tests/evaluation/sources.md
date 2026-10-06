# Evidence Sources Inventory — JEV Traffic Router

Version: 1.0 (T0 draft) · Status: sources identified, not yet validated or licensed.

## 1. ASN / IP Prefix Database

| Attribute | Value |
|-----------|-------|
| Purpose | Map IP → ASN + organization for network context |
| Candidates | MaxMind GeoLite2 ASN (free, requires license key + attribution); RIPE RIS dumps; IPinfo (paid API or downloadable) |
| Format | MMDB or CSV prefix lists, locally queryable |
| License status | **TBD** — requires review of MaxMind EULA terms before integration |
| Update cadence (proposed) | Check every 24h; max staleness 7 days per spec |
| Atomic swap | Replace local snapshot atomically; retain last valid copy with date |
| Integration | Backend job, never in request path; prefix lookup is local and fast |

**Gate**: No ASN source selected or licensed → mark `network_association` coverage as unknown. Local tests use fixture ASN data clearly identified as synthetic.

## 2. Bot Identity Verification

### Verified methods (documented by provider)

| Bot | UA pattern | Reverse DNS suffix | Forward DNS confirm | Official IP list | Status |
|-----|-----------|-------------------|--------------------|-----------------|----|
| Googlebot | `Googlebot/` | `.googlebot.com`, `.google.com` | Yes — PTR → A/AAAA must include original IP | Not published as list; DNS is the method | **Documented** |
| Bingbot | `bingbot/` | `.search.msn.com` | Yes — same PTR→forward check | Not published | **Documented** |
| Google AdsBot | `AdsBot-Google` | `.google.com` | Yes | Not published | **Documented** |

### Unverified / partial methods

| Bot | UA pattern | Reverse DNS suffix | Official IP list | Status |
|-----|-----------|-------------------|-----------------|--------|
| Meta crawler | `facebookexternalhit/`, `Facebot` | No documented official suffix | **Not published** | **Coverage unknown** |
| TikTok bot | `Bytespider`, `TikTok` variants | No documented official suffix | **Not published** | **Coverage unknown** |
| X (Twitter) bot | `Twitterbot/` | No documented official suffix | Not published | **Coverage unknown** |

**Gate**: Bots without a verifiable identity method cannot reach `verified_bot` status. They may still be flagged via Jev assessment as `likely_automation`, but the spec prohibits claiming verified identity without DNS or signature confirmation. Fixtures for these bots must be marked as synthetic and identity as `network_association` or `unknown`, not `verified_bot`.

### Verification procedure (per spec §4.1)
1. Match UA pattern against known bot list.
2. Reverse DNS lookup (PTR) on client IP.
3. Validate PTR result suffix matches expected domain boundary (not substring).
4. Forward DNS lookup (A/AAAA) on PTR result.
5. Confirm original client IP appears in forward lookup results.
6. All steps must succeed within the request deadline; timeout → `unknown`.

### Signed identity
- If a bot provides a cryptographic signature (e.g., signed fetch), validate before assigning `verified_bot`.
- Not currently required by any of the bots above.

## 3. Challenge Provider

| Attribute | Value |
|-----------|-------|
| Purpose | Interactive challenge for low-confidence / insufficient-evidence decisions |
| Candidates | Cloudflare Turnstile (free tier available, server-side validation); hCaptcha (server-side validation) |
| Requirements | Server-side token validation; domain binding; expiration; replay protection; session binding; accessibility in internal browsers (TikTok/Instagram WebViews) |
| License status | **TBD** — not selected |
| Integration | Backend validates token; issues signed session proof (Secure/HttpOnly, 10min TTL initial) |

**Gate**: No challenge provider selected → challenge action falls back to alternative with reason `LOW_EVIDENCE_CHALLENGE`. Fixture challenge tokens are synthetic and clearly marked.

## 4. References

- Cloudflare bot verification (IP validation): https://developers.cloudflare.com/bots/reference/bot-verification/ip-validation/
- Cloudflare bot management variables: https://developers.cloudflare.com/bots/reference/bot-management-variables/
- Jev API reference: https://docs.typesafe.ai/api
- Jev models & pricing: https://docs.typesafe.ai/models
- Jev confidence: https://docs.typesafe.ai/confidence

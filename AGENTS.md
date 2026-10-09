# Architecture rules

- Public actions and action details use the platform theme tokens, typography, radii and shadcn components; do not introduce a separate public visual theme.
- Share action cover rendering between the gallery and action detail via `AcaoCover`; category presentation is browser-safe and centralized so automatic covers remain consistent.
- Keep gallery cards in `AcaoCard` while visibility, date grouping and gallery/calendar state remain in the index route so presentation changes do not change access behavior.
- Keep featured action presentation in `AcaoFeatured` and gallery filters in URL search parameters so shared links preserve the selected view without changing calendar visibility.
- Fetch public participant totals in one aggregate RPC restricted to visible public actions; never expose registration rows to visitors just to show counts.
- Share inclusive calendar-day expansion and ICS serialization in a browser-safe calendar helper; use the same day grouping for the desktop calendar and mobile agenda to avoid interval inconsistencies.
# Architecture rules

- Keep the public actions palette and typography scoped to `.public-actions-theme` in the global stylesheet so administrative screens retain their theme.
- Share action cover rendering between the gallery and action detail via `AcaoCover`; category presentation is browser-safe and centralized so automatic covers remain consistent.
- Keep gallery cards in `AcaoCard` while visibility, date grouping and gallery/calendar state remain in the index route so presentation changes do not change access behavior.
- Keep featured action presentation in `AcaoFeatured` and gallery filters in URL search parameters so shared links preserve the selected view without changing calendar visibility.
- Fetch public participant totals in one aggregate RPC restricted to visible public actions; never expose registration rows to visitors just to show counts.
# Architecture rules

- Keep the public actions palette and typography scoped to `.public-actions-theme` in the global stylesheet so administrative screens retain their theme.
- Share action cover rendering between the gallery and action detail via `AcaoCover`; category presentation is browser-safe and centralized so automatic covers remain consistent.
- Keep gallery cards in `AcaoCard` while visibility, date grouping and gallery/calendar state remain in the index route so presentation changes do not change access behavior.
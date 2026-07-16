# Product

## Register

product

## Users

Primary users are blind and low-vision people standing in front of an unfamiliar restaurant kiosk, often under time pressure from a queue. They use a phone as an audio, camera, and touch-guidance companion to identify the venue, understand the menu, reach a target on the physical screen, and complete payment independently.

Secondary users are sighted contributors who register or update kiosk menu data and track the impact of those contributions.

## Product Purpose

Echo-Menu turns a standard smartphone into a zero-install assistive layer for existing kiosks. Success means a first-time user can enter through spoken language selection, grant the required permissions, identify the nearby venue, explore and select a menu item through touch and spatial audio, and finish payment without needing a staff member to operate the kiosk for them.

## Brand Personality

Calm, direct, and dependable. The product should reduce pressure at every step, speak in short actionable phrases, and make system state unmistakable without feeling clinical or patronizing.

## Anti-references

- Developer dashboards, admin consoles, and simulator controls presented as the primary customer experience.
- Dense screens that expose contribution, leaderboard, diagnostics, and ordering controls at the same time.
- Decorative accessibility theater that relies on color, animation, or visual instruction instead of robust audio and semantic interaction.
- Marketing-first layouts that delay the actual ordering workflow.

## Design Principles

1. One clear task per state: language, permission, venue, menu, steering, or payment.
2. Audio leads and visuals confirm: every visible state must support, never replace, the spoken journey.
3. Recognition over recall: keep the current step, next action, and recovery action continuously available.
4. Safe by default: permission denial, speech failure, and network failure always expose a concrete retry or manual fallback.
5. Separate roles: assistance is the default experience; contribution and demo tooling remain available without competing with the order journey.

## Accessibility & Inclusion

Target WCAG 2.2 AA while designing beyond minimum conformance for blind and low-vision use. Preserve browser zoom, semantic landmarks, keyboard operation, strong visible focus, high contrast, reduced-motion behavior, large touch targets, screen-reader announcements for state changes, and language-correct speech. Gesture-only actions require an equivalent explicit control or spoken recovery path.

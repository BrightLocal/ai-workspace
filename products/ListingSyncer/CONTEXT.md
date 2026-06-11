# ListingSyncer — Context

ListingSyncer is a PHP microservice that synchronises business listings across
third-party platforms: Google My Business, Facebook, Apple Maps, Bing, Yelp, and
Data Axle. It runs as a Swoole HTTP server (port 9501) and exposes a REST API
consumed by BrightLocal Tools.

## Repository

`/home/lenovo/brightLocal/ListingSyncer` (or `github.com/BrightLocal/ListingSyncer`)

## Architecture

```
src/
├── Modules/          # Platform integrations (modular monolith)
│   ├── DataAxle/
│   ├── Bing/
│   └── Yelp/
├── Service/          # Core logic (GMB, Facebook, Apple, Twitter, Active Sync)
├── Entity/           # Doctrine ORM entities
├── Repository/       # Core Doctrine repositories
├── Controller/       # HTTP controllers (Symfony + Nelmio API Doc)
└── Worker/           # Symfony Messenger consumers
```

Each `src/Modules/<Platform>/` follows a strict layered structure:
`Domain/` → `Application/` → `Infrastructure/` → `Adapter/CLI|HTTP/`

## Key integration points

- **Tools → LS**: Tools calls LS over HTTP. The `listingSyncerHttpClient` Guzzle
  client in Tools uses `ListingSyncerGuzzleProvider` with `retriesCount = 2`.
  Client errors (4xx) are NOT retried; server errors (5xx) are.
- **LS → Third-party APIs**: Each module has its own `ApiClient` that calls the
  external platform. Errors are mapped to meaningful HTTP status codes before
  being returned to Tools — see `docs/third-party-error-mapping.md`.

## Reference docs

- `docs/third-party-error-mapping.md` — how third-party API errors are translated
  to LS HTTP responses consumed by Tools

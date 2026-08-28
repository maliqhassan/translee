# Transee translation backend

A small HTTP service that sits between the mobile app and a translation
provider. It exists for one reason: **the provider credential must never ship
inside the app**, where anyone can read it out of the bundle.

```
Transee app  ->  this service  ->  Azure AI Translator
   (public URL)   (holds the key)
```

The app knows only this service's public URL. It never sees a provider key, a
provider request, or a provider response.

## Running it

```bash
npm install
cp .env.example .env      # then fill in the values
npm run build && npm start
```

For local development with no Azure account, run the deterministic stand-in —
it marks its output so a fake result can never be mistaken for a real one:

```bash
TRANSLATION_PROVIDER=fake npm start
```

Point the app at it with `EXPO_PUBLIC_TRANSEE_API_URL` (see the repo README).

## Environment variables

| Variable                       | Required               | Purpose                                      |
| ------------------------------ | ---------------------- | -------------------------------------------- |
| `TRANSLATION_PROVIDER_API_KEY` | yes, unless `fake`     | Azure Translator key. **Secret.**            |
| `TRANSLATION_PROVIDER_REGION`  | for regional resources | e.g. `westeurope`                            |
| `TRANSLATION_PROVIDER`         | no                     | `azure` (default) or `fake`                  |
| `PORT`                         | no                     | Defaults to `8787`                           |
| `MAX_TEXT_LENGTH`              | no                     | Defaults to `5000` characters                |
| `MAX_BODY_BYTES`               | no                     | Defaults to 64 KB                            |
| `PROVIDER_TIMEOUT_MS`          | no                     | Defaults to `10000`                          |
| `RATE_LIMIT_MAX`               | no                     | Requests per window per client, default `60` |
| `RATE_LIMIT_WINDOW_MS`         | no                     | Window length, default `60000`               |

Get an Azure key by creating a **Translator** resource in the Azure portal; the
key and region are on its _Keys and Endpoint_ page. The free F0 tier covers
2M characters per month.

`.env` is gitignored. Never commit a real key, and never put one in
`EXPO_PUBLIC_*` — Expo inlines those into the app bundle.

## API

### `POST /translation`

```json
{ "sourceLanguage": "en", "targetLanguage": "de", "text": "Hello, how are you?" }
```

```json
{
  "translatedText": "Hallo, wie geht es dir?",
  "sourceLanguage": "en",
  "targetLanguage": "de",
  "detectedLanguage": "en"
}
```

`sourceLanguage` accepts `auto`, in which case `detectedLanguage` comes back.
`targetLanguage` never accepts `auto`. Languages are Transee **LanguageIds**
(`zh-Hans`, `pt-BR`), not provider codes — mapping happens here.

Errors are `{ "error": { "code": ..., "message": ... } }`:

| Code                   | Status | Meaning                                   |
| ---------------------- | ------ | ----------------------------------------- |
| `invalid_request`      | 400    | Malformed body, empty text, same-to-same  |
| `text_too_long`        | 413    | Over `MAX_TEXT_LENGTH` or body cap        |
| `unsupported_language` | 422    | Provider cannot handle that language      |
| `rate_limited`         | 429    | Too many requests, `Retry-After` set      |
| `provider_error`       | 502    | Provider returned something unusable      |
| `provider_unavailable` | 503    | Provider down, timed out, or unconfigured |

### `GET /health`

`{ "status": "ok", "provider": "azure-translator" }` — never reports whether a
credential is present.

### `GET /languages`

The LanguageIds this deployment can translate.

## Security

- The key is used only as a request header, and is never logged, echoed, or
  included in a response. Tests assert this.
- A provider auth failure (401/403) is reported to clients as
  `provider_unavailable`. Telling a caller the credential is wrong tells an
  attacker where to push.
- Thrown network causes are dropped rather than forwarded: they can carry the
  request URL and headers, which include the key.
- Request bodies are capped before parsing, on `Content-Length` and while
  streaming.
- User text is never logged.

## Rate limiting

Fixed-window and in-memory, sized to protect the provider quota from a runaway
client on one instance. It is not a security control and does not survive a
restart or coordinate across instances. Doing that properly means shared state;
the boundary in `rate-limit.ts` is where that swap goes when it is genuinely
needed.

## Tests

```bash
npm test        # 59 tests, Node's built-in runner, no framework dependency
```

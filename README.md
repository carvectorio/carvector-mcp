# carvector-mcp

**Give your AI agent real vehicle data.** An [MCP](https://modelcontextprotocol.io) server that lets Claude, Cursor, ChatGPT, or any MCP-capable client query the [CarVector](https://carvector.io) API natively — vehicle specs, representative images, federal recalls, owner complaints, service bulletins, defect investigations, and OBD-II diagnostic trouble codes.

Models hallucinate car data. They invent horsepower numbers, miss recalls filed last week, and guess at what a trouble code means. `carvector-mcp` gives your agent **structured, sourced answers it can cite** instead of a confident guess.

```
npx -y carvector-mcp --key cv_your_key
```

[![npm](https://img.shields.io/npm/v/carvector-mcp)](https://www.npmjs.com/package/carvector-mcp) · MIT · Free tier, no card → [carvector.io](https://carvector.io)

---

## Quickstart

**1. Get a free API key** at [carvector.io](https://carvector.io) — 500 requests a month, no credit card.

**2. Add it to your MCP client.** Most clients use an `mcpServers` block:

```json
{
  "mcpServers": {
    "carvector": {
      "command": "npx",
      "args": ["-y", "carvector-mcp"],
      "env": { "CARVECTOR_API_KEY": "cv_your_key" }
    }
  }
}
```

That's it. Restart your client and ask it about a vehicle.

> **Prefer a remote server?** If your client supports HTTP MCP, skip the install and point it straight at the hosted endpoint:
> ```json
> { "mcpServers": { "carvector": {
>     "url": "https://api.carvector.io/v1/mcp",
>     "headers": { "Authorization": "Bearer cv_your_key" } } } }
> ```

---

## Tools

| Tool | What it returns |
|------|-----------------|
| `search_vehicles` | Matching vehicles by year / make / model, with ids + specs |
| `get_vehicle` | Full specs for one vehicle — engine, drivetrain, body, image, recall count |
| `get_recalls` | Federal recall campaigns for a vehicle — component, summary, consequence, remedy |
| `get_complaints` | Owner-complaint signal for a vehicle — aggregate by component + the most recent complaints *(Pro plan)* |
| `get_tsbs` | Manufacturer service-bulletin index for a vehicle — the fix the dealer already knows about *(Business plan)* |
| `get_investigations` | Federal defect investigations for a vehicle — a leading indicator of recalls *(Business plan)* |
| `lookup_dtc` | An OBD-II code's title, category, severity, and safety/emissions flags |

The agent chains them naturally: `search_vehicles` to resolve an id, then `get_vehicle`, `get_recalls`, `get_complaints`, `get_tsbs`, or `get_investigations`.

---

## Example

> **You:** "Is a P0300 code serious?"

```js
→ carvector.lookup_dtc({ code: "P0300" })
{
  "code": "P0300",
  "title": "Random/Multiple Cylinder Misfire Detected",
  "category": "Powertrain",
  "severity": "High",
  "safety_risk": true,
  "emissions_related": true
}
```

Your agent answers: *"Yes — P0300 is a high-severity, safety-related misfire code. Don't keep driving on it."* Sourced, not guessed.

---

## Three things to build with it

- **A service-advisor copilot** that pulls a customer's exact trim, open recalls, the manufacturer's documented fix (TSBs), the complaint pattern behind a symptom, and a decoded check-engine code — in one turn, no tab-switching.
- **A consumer car chatbot** that answers "what engine does my truck have" and "is it under recall" with real data instead of a hallucination.
- **A coding/automotive agent** that needs structured vehicle knowledge as a tool, not a wall of scraped text to parse.

---

## About the data

`carvector-mcp` is an open-source, thin client. It bundles **no data** — every call forwards to the CarVector API, authenticated with your key. What you get back:

- **Vehicles** — a broad catalog (1925–2029), broken out by trim and engine variant, with representative illustrations (not photos).
- **Recalls** — federal recall campaigns mapped to year / make / model.
- **Complaints** — owner-filed complaints aggregated by component (with crash / fire / injury counts) plus the most recent filings, mapped to a vehicle. *(Pro plan.)*
- **Service bulletins (TSBs)** — the manufacturer's technical service-bulletin index — metadata, not the documents. *(Business plan.)*
- **Investigations** — federal defect investigations, a leading indicator that often precedes a recall. *(Business plan.)*
- **DTC reference** — OBD-II codes classified by category, severity, and safety/emissions flags. *Reference only — repair-cost economics is on the roadmap, not in responses today.*

Calls count against your plan's rate limit and show up in your [dashboard](https://carvector.io/dashboard), exactly like a REST request.

---

## Open source & your key

This client is ~150 lines of readable JavaScript — please read them. It:

- talks to **one host only** — `api.carvector.io` (grep `index.js`, it's the only URL),
- sends your key **only** as a `Bearer` header to that host, nowhere else,
- has **zero** telemetry, analytics, or phone-home, and writes nothing to disk,
- depends on exactly one package: the official [`@modelcontextprotocol/sdk`](https://www.npmjs.com/package/@modelcontextprotocol/sdk).

Your key stays on your machine. Set it via the `CARVECTOR_API_KEY` env var (preferred); `--key` works too but, like any CLI argument, is visible in process listings.

## License

MIT. The client is open source; the data is served by [CarVector](https://carvector.io).

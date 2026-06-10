#!/usr/bin/env node
// carvector-mcp — a Model Context Protocol server that gives any MCP-capable AI
// agent (Claude, Cursor, ChatGPT, …) real vehicle data from the CarVector API:
// specs, representative images, federal recalls, and OBD-II DTC reference.
//
// It's a thin, open-source client: it forwards each tool call to the public
// CarVector REST API authenticated with YOUR key. No data is bundled here.
// Get a free key at https://carvector.io.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const BASE = process.env.CARVECTOR_BASE_URL || 'https://api.carvector.io';
const VERSION = '1.1.0';

const ARGV = process.argv.slice(2);
if (ARGV.includes('--version') || ARGV.includes('-v')) {
	process.stdout.write(`carvector-mcp ${VERSION}\n`);
	process.exit(0);
}
if (ARGV.includes('--help') || ARGV.includes('-h')) {
	process.stdout.write(
		`carvector-mcp ${VERSION} — MCP server for real vehicle data (specs, images, recalls, DTC reference).\n\n` +
			`Add to your MCP client config:\n` +
			`  { "command": "npx", "args": ["-y", "carvector-mcp"],\n` +
			`    "env": { "CARVECTOR_API_KEY": "cv_your_key" } }\n\n` +
			`Flags:\n` +
			`  --key <cv_…>   API key (prefer the CARVECTOR_API_KEY env var)\n` +
			`  --version, -v  print version\n` +
			`  --help, -h     show this help\n\n` +
			`Tools: search_vehicles, get_vehicle, get_recalls, get_complaints, get_tsbs, get_investigations, lookup_dtc\n` +
			`Free key + docs: https://carvector.io\n`
	);
	process.exit(0);
}

function resolveKey() {
	const i = process.argv.indexOf('--key');
	if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
	return process.env.CARVECTOR_API_KEY || '';
}
const KEY = resolveKey();
if (!KEY) {
	process.stderr.write(
		'carvector-mcp: no API key.\n' +
			'  Set CARVECTOR_API_KEY=cv_… or pass --key cv_…\n' +
			'  Get a free key at https://carvector.io\n'
	);
	process.exit(1);
}

async function api(path) {
	const res = await fetch(`${BASE}/v1${path}`, {
		headers: { Authorization: `Bearer ${KEY}`, 'User-Agent': 'carvector-mcp' }
	});
	let body;
	try {
		body = await res.json();
	} catch {
		body = null;
	}
	return { status: res.status, body };
}

// Optional limit/since query string for the per-vehicle failure endpoints.
function listQuery(a) {
	const q = new URLSearchParams();
	if (a.limit != null) q.set('limit', String(a.limit));
	if (a.since) q.set('since', String(a.since));
	const s = q.toString();
	return s ? `?${s}` : '';
}

const TOOLS = [
	{
		name: 'search_vehicles',
		description:
			'Search the CarVector catalog by year, make, and/or model. Returns matching vehicles with their id and specs. Use this first to resolve a vehicle id, then call get_vehicle or get_recalls with that id.',
		inputSchema: {
			type: 'object',
			properties: {
				year: { type: 'integer', description: 'Model year, e.g. 2019.' },
				make: { type: 'string', description: 'Make, e.g. Toyota (case-insensitive).' },
				model: { type: 'string', description: 'Model, e.g. Tacoma (case-insensitive).' },
				limit: { type: 'integer', description: 'Max results, 1–100 (default 25).' }
			}
		},
		call: (a) => {
			const q = new URLSearchParams();
			if (a.year != null) q.set('year', String(a.year));
			if (a.make) q.set('make', String(a.make));
			if (a.model) q.set('model', String(a.model));
			q.set('limit', String(Math.min(100, Math.max(1, Number(a.limit) || 25))));
			return api(`/vehicles?${q.toString()}`);
		}
	},
	{
		name: 'get_vehicle',
		description:
			'Get full specifications for one vehicle by its id (an opaque token returned by search_vehicles). Returns engine, drivetrain, body details, a representative image, and recall count.',
		inputSchema: {
			type: 'object',
			properties: { id: { type: 'string', description: 'Vehicle id from search_vehicles.' } },
			required: ['id']
		},
		call: (a) => api(`/vehicles/${encodeURIComponent(String(a.id ?? ''))}`)
	},
	{
		name: 'get_recalls',
		description:
			'Get federal recall campaigns for a vehicle by its id. Returns each campaign with component, summary, consequence, and remedy.',
		inputSchema: {
			type: 'object',
			properties: { id: { type: 'string', description: 'Vehicle id (same format as get_vehicle).' } },
			required: ['id']
		},
		call: (a) => api(`/vehicles/${encodeURIComponent(String(a.id ?? ''))}/recalls`)
	},
	{
		name: 'lookup_dtc',
		description:
			'Look up an OBD-II diagnostic trouble code (e.g. P0420). Returns the code title, category, severity, and safety/emissions flags. Reference only — does not include repair cost estimates.',
		inputSchema: {
			type: 'object',
			properties: { code: { type: 'string', description: 'OBD-II code, e.g. P0420.' } },
			required: ['code']
		},
		call: (a) => api(`/dtc/${encodeURIComponent(String(a.code ?? ''))}`)
	},
	{
		name: 'get_complaints',
		description:
			'Get the owner-complaint signal for a vehicle by its id: an aggregate (totals by component and year, plus crash/fire/injury counts) and the most-recent complaints. Requires a Pro plan or higher.',
		inputSchema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: 'Vehicle id from search_vehicles.' },
				limit: { type: 'integer', description: 'Most-recent complaints to return, 1–10 (default 10).' },
				since: { type: 'string', description: 'Only complaints on/after this ISO date, YYYY-MM-DD.' }
			},
			required: ['id']
		},
		call: (a) => api(`/vehicles/${encodeURIComponent(String(a.id ?? ''))}/complaints${listQuery(a)}`)
	},
	{
		name: 'get_tsbs',
		description:
			'Get the manufacturer technical service bulletin (TSB) index for a vehicle by its id — bulletin metadata (id, date, type, affected components, summary), not the documents themselves. Requires a Business plan or higher.',
		inputSchema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: 'Vehicle id from search_vehicles.' },
				limit: { type: 'integer', description: 'Bulletins to return, 1–50 (default 50).' },
				since: { type: 'string', description: 'Only bulletins on/after this ISO date, YYYY-MM-DD.' }
			},
			required: ['id']
		},
		call: (a) => api(`/vehicles/${encodeURIComponent(String(a.id ?? ''))}/tsbs${listQuery(a)}`)
	},
	{
		name: 'get_investigations',
		description:
			'Get federal defect investigations for a vehicle by its id — a leading indicator that often precedes recalls. Returns each action with subject, component, open/close dates, and status. Requires a Business plan or higher.',
		inputSchema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: 'Vehicle id from search_vehicles.' },
				limit: { type: 'integer', description: 'Investigations to return, 1–100 (default 100).' },
				since: { type: 'string', description: 'Only investigations opened on/after this ISO date, YYYY-MM-DD.' }
			},
			required: ['id']
		},
		call: (a) => api(`/vehicles/${encodeURIComponent(String(a.id ?? ''))}/investigations${listQuery(a)}`)
	}
];

const err = (text) => ({ content: [{ type: 'text', text }], isError: true });

const server = new Server(
	{ name: 'carvector', version: VERSION },
	{
		capabilities: { tools: {} },
		instructions:
			'CarVector exposes real, multi-source-verified vehicle data: specs, representative images, federal recalls, owner complaints, manufacturer service bulletins (TSBs), defect investigations, and OBD-II DTC reference. To answer questions about a specific vehicle, first call search_vehicles to resolve its id, then get_vehicle, get_recalls, get_complaints, get_tsbs, or get_investigations. Do not invent vehicle data — use these tools.'
	}
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
	tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }))
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
	const tool = TOOLS.find((t) => t.name === req.params.name);
	if (!tool) return err(`Unknown tool: ${req.params.name}`);
	try {
		const { status, body } = await tool.call(req.params.arguments ?? {});
		if (status === 401) return err('Invalid or missing CarVector API key. Get a free key at https://carvector.io.');
		if (status === 429) return err('Rate limit reached for your plan. Try again later, or upgrade at https://carvector.io/pricing.');
		if (status === 403) return err(body?.message || 'This tool requires a higher plan. Upgrade at https://carvector.io/pricing.');
		if (status === 404 || body == null) return err('Not found — no matching vehicle or code.');
		if (status >= 400) return err(`CarVector API error (${status}): ${JSON.stringify(body)}`);
		return { content: [{ type: 'text', text: JSON.stringify(body, null, 2) }] };
	} catch (e) {
		return err(`Request to CarVector failed: ${e instanceof Error ? e.message : String(e)}`);
	}
});

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write('carvector-mcp connected — 7 tools ready (search_vehicles, get_vehicle, get_recalls, get_complaints, get_tsbs, get_investigations, lookup_dtc)\n');

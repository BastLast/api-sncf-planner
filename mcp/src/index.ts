#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ── SNCF API ──

const ODS_BASE = "https://data.sncf.com/api/explore/v2.1/catalog/datasets";
const DATASET = "tgvmax";
const DEFAULT_LIMIT = 90;
const MAX_PAGES = 6;

// Common station aliases → exact API names
const STATION_ALIASES: Record<string, string> = {
  "PARIS": "PARIS (intramuros)",
  "LYON": "LYON (intramuros)",
  "LYON PART DIEU": "LYON (intramuros)",
  "LYON PART-DIEU": "LYON (intramuros)",
  "LYON PERRACHE": "LYON (intramuros)",
  "MARSEILLE": "MARSEILLE ST CHARLES",
  "MONTPELLIER": "MONTPELLIER SAINT ROCH",
  "MONTPELLIER SAINT-ROCH": "MONTPELLIER SAINT ROCH",
  "MONTPELLIER ST ROCH": "MONTPELLIER SAINT ROCH",
  "BORDEAUX": "BORDEAUX ST JEAN",
  "BORDEAUX SAINT-JEAN": "BORDEAUX ST JEAN",
  "TOULOUSE": "TOULOUSE MATABIAU",
  "NANTES": "NANTES",
  "STRASBOURG": "STRASBOURG",
  "LILLE": "LILLE (intramuros)",
  "RENNES": "RENNES",
  "NICE": "NICE VILLE",
  "AVIGNON": "AVIGNON TGV",
  "AIX": "AIX EN PROVENCE TGV",
  "AIX EN PROVENCE": "AIX EN PROVENCE TGV",
  "SAINT ETIENNE": "SAINT ETIENNE CHATEAUCREUX",
  "ST ETIENNE": "SAINT ETIENNE CHATEAUCREUX",
};

// Cache for station list (avoid repeated API calls)
let stationCache: { stations: string[]; date: string | null; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface Train {
  date: string;
  origine: string;
  destination: string;
  heure_depart: string;
  heure_arrivee: string;
  train_no: string;
  axe: string;
  entity: string;
}

function toRefineDate(dateStr: string): string {
  return dateStr.replaceAll("-", "/");
}

async function fetchTrains(options: {
  date?: string;
  origin?: string;
  destination?: string;
  limit?: number;
}): Promise<Train[]> {
  const { date, origin, destination, limit = DEFAULT_LIMIT } = options;

  const aggregated: Train[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    if (page > 0) params.set("offset", String(page * limit));
    if (date) params.append("refine", `date:${toRefineDate(date)}`);
    params.append("refine", "od_happy_card:OUI");
    if (origin) params.append("refine", `origine:${origin.trim()}`);
    if (destination) params.append("refine", `destination:${destination.trim()}`);

    const url = `${ODS_BASE}/${DATASET}/records?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`SNCF API error: ${res.status} ${res.statusText}`);

    const data = await res.json();
    const results = Array.isArray(data.results) ? data.results : [];

    for (const r of results) {
      aggregated.push({
        date: r.date,
        origine: r.origine,
        destination: r.destination,
        heure_depart: r.heure_depart || r.heure || "00:00",
        heure_arrivee: r.heure_arrivee || "",
        train_no: r.train_no || r.numero || "",
        axe: r.axe || "",
        entity: r.entity || "",
      });
    }

    if (results.length < limit) break;
  }

  // Dedupe
  const seen = new Set<string>();
  const deduped: Train[] = [];
  for (const t of aggregated) {
    const key = `${t.date}|${t.origine}|${t.destination}|${t.train_no}|${t.heure_depart}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(t);
    }
  }

  deduped.sort((a, b) => a.heure_depart.localeCompare(b.heure_depart));
  return deduped;
}

async function fetchStations(date?: string): Promise<string[]> {
  const stations: string[] = [];
  const PAGE_SIZE = 100;
  let offset = 0;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    const params = new URLSearchParams();
    params.set("select", "origine");
    params.set("group_by", "origine");
    params.set("limit", String(PAGE_SIZE));
    if (offset > 0) params.set("offset", String(offset));
    if (date) params.append("refine", `date:${toRefineDate(date)}`);
    params.append("refine", "od_happy_card:OUI");

    const url = `${ODS_BASE}/${DATASET}/records?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`SNCF API error: ${res.status} ${res.statusText}`);

    const data = await res.json();
    const results: { origine: string }[] = data.results || [];
    for (const r of results) {
      if (r.origine) stations.push(r.origine);
    }

    if (results.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  stations.sort((a, b) => a.localeCompare(b));
  return stations;
}

/**
 * Resolve a station name input to the exact API station name.
 * Tries: exact match, alias lookup, substring match, fuzzy match.
 * Returns [resolvedName, wasExact] or throws with suggestions.
 */
async function resolveStation(input: string, date?: string): Promise<[string, boolean]> {
  const upper = input.toUpperCase().trim();

  // 1. Check aliases first
  if (STATION_ALIASES[upper]) {
    return [STATION_ALIASES[upper], false];
  }

  // 2. Get station list (cached)
  const stations = await getCachedStations(date);

  // 3. Exact match
  if (stations.includes(upper)) {
    return [upper, true];
  }

  // 4. Substring match (input is contained in station name, or station name contains input)
  const substringMatches = stations.filter((s) =>
    s.includes(upper) || upper.includes(s)
  );
  if (substringMatches.length === 1) {
    return [substringMatches[0], false];
  }

  // 5. Word-start match (each word in input matches the start of a word in station name)
  const inputWords = upper.split(/\s+/);
  const wordStartMatches = stations.filter((s) => {
    const stationWords = s.split(/\s+/);
    return inputWords.every((iw) =>
      stationWords.some((sw) => sw.startsWith(iw))
    );
  });
  if (wordStartMatches.length === 1) {
    return [wordStartMatches[0], false];
  }

  // 6. If we have multiple matches, return the closest one (shortest name = most specific)
  const allMatches = [...new Set([...substringMatches, ...wordStartMatches])];
  if (allMatches.length > 0) {
    allMatches.sort((a, b) => a.length - b.length);
    return [allMatches[0], false];
  }

  // 7. No match found — build suggestion list
  const suggestions = stations
    .filter((s) => {
      const words = upper.split(/\s+/);
      return words.some((w) => w.length >= 3 && s.includes(w));
    })
    .slice(0, 5);

  const suggestionText = suggestions.length > 0
    ? `\nDid you mean: ${suggestions.join(", ")}?`
    : "\nUse list_stations to see all available station names.";

  throw new Error(`Station "${input}" not found in the TGVmax network.${suggestionText}`);
}

async function getCachedStations(date?: string): Promise<string[]> {
  const now = Date.now();
  if (stationCache && (now - stationCache.fetchedAt) < CACHE_TTL_MS && stationCache.date === (date ?? null)) {
    return stationCache.stations;
  }
  const stations = await fetchStations(date);
  stationCache = { stations, date: date ?? null, fetchedAt: now };
  return stations;
}

// ── Auto planner ──

const MIN_CONNECTION_MIN = 30;
const MAX_DAYS_AHEAD = 5;
const MAX_INTERMEDIATES = 12;

interface Segment {
  depart: string;
  heure_depart: string;
  arrivee: string;
  heure_arrivee: string;
  date: string;
  train_no: string;
  departure_datetime: string;
  arrival_datetime: string;
}

function parseDateTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, hour || 0, minute || 0);
}

function dateToDateStr(dt: Date): string {
  const y = dt.getFullYear();
  const m = (dt.getMonth() + 1).toString().padStart(2, "0");
  const d = dt.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDaysToDate(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return dateToDateStr(date);
}

function buildSegment(from: string, to: string, train: Train, date: string): Segment {
  const depDT = parseDateTime(date, train.heure_depart);
  let arrDT = parseDateTime(date, train.heure_arrivee || train.heure_depart);
  if (arrDT <= depDT) arrDT = new Date(arrDT.getTime() + 86400000);

  return {
    depart: from,
    heure_depart: train.heure_depart,
    arrivee: to,
    heure_arrivee: train.heure_arrivee,
    date,
    train_no: train.train_no,
    departure_datetime: depDT.toISOString(),
    arrival_datetime: arrDT.toISOString(),
  };
}

interface Route {
  segments: Segment[];
  arrivalDT: Date;
}

async function tryDirect(from: string, to: string, date: string, afterTime: string | null): Promise<Route | null> {
  const trains = await fetchTrains({ date, origin: from, destination: to });
  const valid = afterTime ? trains.filter((t) => t.heure_depart > afterTime) : trains;
  if (!valid.length) return null;

  let bestTrain = valid[0];
  let bestSeg = buildSegment(from, to, bestTrain, date);
  let bestArr = parseDateTime(date, bestTrain.heure_arrivee || bestTrain.heure_depart);

  for (let i = 1; i < valid.length; i++) {
    const seg = buildSegment(from, to, valid[i], date);
    const arr = new Date(seg.arrival_datetime);
    if (arr < bestArr) {
      bestTrain = valid[i];
      bestSeg = seg;
      bestArr = arr;
    }
  }

  return { segments: [bestSeg], arrivalDT: bestArr };
}

async function tryOneConnection(
  from: string,
  to: string,
  date: string,
  afterTime: string | null,
  excludeCities: Set<string>
): Promise<Route | null> {
  const fromTrains = await fetchTrains({ date, origin: from });
  const valid = afterTime ? fromTrains.filter((t) => t.heure_depart > afterTime) : fromTrains;
  if (!valid.length) return null;

  const byDest: Record<string, Train[]> = {};
  for (const t of valid) {
    const d = t.destination;
    if (!byDest[d]) byDest[d] = [];
    if (byDest[d].length < 3) byDest[d].push(t);
  }

  const mids = Object.keys(byDest)
    .filter((d) => d !== from && d !== to && !excludeCities.has(d))
    .sort((a, b) => (byDest[a][0].heure_arrivee || "").localeCompare(byDest[b][0].heure_arrivee || ""))
    .slice(0, MAX_INTERMEDIATES);

  if (!mids.length) return null;

  const results = await Promise.allSettled(
    mids.map(async (mid) => {
      let bestForMid: Route | null = null;
      for (const t1 of byDest[mid]) {
        const seg1 = buildSegment(from, mid, t1, date);
        const connTime = new Date(new Date(seg1.arrival_datetime).getTime() + MIN_CONNECTION_MIN * 60000);
        const connTimeStr = connTime.toTimeString().slice(0, 5);
        const searchDate2 = dateToDateStr(connTime);

        const midTrains = await fetchTrains({ date: searchDate2, origin: mid, destination: to });
        const validMid = midTrains.filter((t) => {
          if (searchDate2 === date) return t.heure_depart >= connTimeStr;
          return true;
        });
        if (!validMid.length) continue;

        const seg2 = buildSegment(mid, to, validMid[0], searchDate2);
        const arrDT = new Date(seg2.arrival_datetime);
        const candidate: Route = { segments: [seg1, seg2], arrivalDT: arrDT };
        if (!bestForMid || candidate.arrivalDT < bestForMid.arrivalDT) bestForMid = candidate;
      }
      return bestForMid;
    })
  );

  let best: Route | null = null;
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) {
      if (!best || r.value.arrivalDT < best.arrivalDT) best = r.value;
    }
  }
  return best;
}

async function findRoute(
  from: string,
  to: string,
  date: string,
  afterTime: string | null,
  excludeCities: Set<string>
): Promise<Route | null> {
  for (let d = 0; d <= MAX_DAYS_AHEAD; d++) {
    const searchDate = d === 0 ? date : addDaysToDate(date, d);
    const time = d === 0 ? afterTime : null;

    const [direct, conn] = await Promise.all([
      tryDirect(from, to, searchDate, time),
      tryOneConnection(from, to, searchDate, time, excludeCities),
    ]);

    let best: Route | null = null;
    if (direct && conn) {
      best = direct.arrivalDT <= conn.arrivalDT ? direct : conn;
    } else {
      best = direct || conn;
    }

    if (best) return best;
  }
  return null;
}

interface WaypointInput {
  city: string;
  min_nights?: number;
}

async function planItinerary(config: {
  departure: string;
  arrival: string;
  start_date: string;
  waypoints?: WaypointInput[];
}): Promise<{ success: boolean; segments: Segment[]; error?: string }> {
  const { departure, arrival, start_date, waypoints = [] } = config;
  const cities = [departure, ...waypoints.map((w) => w.city), arrival];

  const nightsMap: Record<string, number> = {};
  waypoints.forEach((w) => {
    nightsMap[w.city] = w.min_nights || 0;
  });

  const allSegments: Segment[] = [];
  let currentDate = start_date;
  let afterTime: string | null = null;
  const visitedCities = new Set<string>();
  visitedCities.add(departure);

  for (let i = 0; i < cities.length - 1; i++) {
    const from = cities[i];
    const to = cities[i + 1];

    if (i > 0 && nightsMap[from] > 0) {
      currentDate = addDaysToDate(currentDate, nightsMap[from]);
      afterTime = null;
    }

    const route = await findRoute(from, to, currentDate, afterTime, visitedCities);
    if (!route) {
      return {
        success: false,
        segments: allSegments,
        error: `No route found from ${from} to ${to} (from ${currentDate}, ${MAX_DAYS_AHEAD + 1} days searched).`,
      };
    }

    allSegments.push(...route.segments);

    for (const seg of route.segments) {
      visitedCities.add(seg.depart);
      visitedCities.add(seg.arrivee);
    }

    const lastSeg = route.segments[route.segments.length - 1];
    currentDate = dateToDateStr(new Date(lastSeg.arrival_datetime));
    afterTime = new Date(lastSeg.arrival_datetime).toTimeString().slice(0, 5);
  }

  return { success: true, segments: allSegments };
}

// ── Duration helper ──

function formatDuration(startIso: string, endIso: string): string {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  const minutes = Math.floor(ms / 60000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m.toString().padStart(2, "0")}`;
}

// ── MCP Server ──

const server = new McpServer({
  name: "sncf-tgvmax",
  version: "1.0.0",
});

// Tool 1: Search trains
server.tool(
  "search_trains",
  `Search for available TGVmax trains on the SNCF network.

IMPORTANT:
- This searches ONLY trains eligible for the TGVmax subscription (free travel pass). Not all SNCF trains.
- Station names are auto-resolved: "lyon" → "LYON (intramuros)", "montpellier" → "MONTPELLIER ST ROCH", etc.
- Date format: YYYY-MM-DD (e.g., "2026-05-14")
- You MUST search one specific date at a time. To cover a range, call this tool multiple times.
- If no results: try adjacent dates, or use plan_itinerary which searches connections through intermediate cities.
- Common stations: PARIS (intramuros), LYON (intramuros), MARSEILLE ST CHARLES, MONTPELLIER SAINT ROCH, MONTPELLIER SUD DE FRANCE, TOULOUSE MATABIAU, BORDEAUX ST JEAN, NICE VILLE, AVIGNON TGV, STRASBOURG, NANTES, RENNES, LILLE (intramuros).

TYPICAL WORKFLOW for finding a trip:
1. Search outbound trains: search_trains(date="2026-05-14", origin="lyon", destination="montpellier")
2. Search return trains: search_trains(date="2026-05-18", origin="montpellier", destination="lyon")
3. If no direct results, try plan_itinerary which finds connections automatically.
4. To maximize time at destination: pick the earliest outbound and latest return.`,
  {
    date: z.string().describe("Date in YYYY-MM-DD format (e.g., '2026-05-14')"),
    origin: z.string().optional().describe("Departure station (auto-resolved, e.g., 'lyon', 'PARIS (intramuros)')"),
    destination: z.string().optional().describe("Arrival station (auto-resolved, e.g., 'montpellier', 'MARSEILLE ST CHARLES')"),
  },
  async ({ date, origin, destination }) => {
    try {
      // Auto-resolve station names
      let resolvedOrigin = origin;
      let resolvedDest = destination;
      const notes: string[] = [];

      if (origin) {
        const [resolved, exact] = await resolveStation(origin, date);
        resolvedOrigin = resolved;
        if (!exact && origin.toUpperCase().trim() !== resolved) {
          notes.push(`Origin "${origin}" resolved to "${resolved}"`);
        }
      }
      if (destination) {
        const [resolved, exact] = await resolveStation(destination, date);
        resolvedDest = resolved;
        if (!exact && destination.toUpperCase().trim() !== resolved) {
          notes.push(`Destination "${destination}" resolved to "${resolved}"`);
        }
      }

      const trains = await fetchTrains({ date, origin: resolvedOrigin, destination: resolvedDest });

      if (trains.length === 0) {
        let text = `No TGVmax trains found for date: ${date}`;
        if (resolvedOrigin) text += `, from: ${resolvedOrigin}`;
        if (resolvedDest) text += `, to: ${resolvedDest}`;
        text += ".";
        if (notes.length > 0) text += `\n(${notes.join("; ")})`;
        text += "\n\nTIPS: Try adjacent dates, or use plan_itinerary to find routes with connections. Also try searching without destination to see all available trains from the origin.";
        return { content: [{ type: "text", text }] };
      }

      // Group by destination for readability
      const grouped: Record<string, Train[]> = {};
      for (const t of trains) {
        const dest = t.destination;
        if (!grouped[dest]) grouped[dest] = [];
        grouped[dest].push(t);
      }

      let text = `Found ${trains.length} TGVmax train(s) on ${date}`;
      if (resolvedOrigin) text += ` from ${resolvedOrigin}`;
      if (resolvedDest) text += ` to ${resolvedDest}`;
      text += ":\n";
      if (notes.length > 0) text += `(${notes.join("; ")})\n`;
      text += "\n";

      for (const [dest, destTrains] of Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b))) {
        text += `## → ${dest} (${destTrains.length} train${destTrains.length > 1 ? "s" : ""})\n`;
        for (const t of destTrains) {
          const duration = t.heure_arrivee ? ` (${formatDuration(`2000-01-01T${t.heure_depart}`, `2000-01-01T${t.heure_arrivee}`)})` : "";
          text += `- ${t.heure_depart} → ${t.heure_arrivee || "?"} | Train ${t.train_no || "?"}${duration}\n`;
        }
        text += "\n";
      }

      return { content: [{ type: "text", text }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
    }
  }
);

// Tool 2: List stations
server.tool(
  "list_stations",
  `List all SNCF stations that have TGVmax-eligible trains. Returns exact station names needed for search_trains and plan_itinerary.

Note: Station names in search_trains and plan_itinerary are auto-resolved, so you usually don't need to call this first. Use this tool only if you need to browse all available stations or verify a station name.`,
  {
    date: z.string().optional().describe("Optional date in YYYY-MM-DD format to filter stations with trains on that day"),
  },
  async ({ date }) => {
    try {
      const stations = await fetchStations(date);
      let text = `${stations.length} station(s) with TGVmax trains`;
      if (date) text += ` on ${date}`;
      text += ":\n\n";
      text += stations.join("\n");
      return { content: [{ type: "text", text }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
    }
  }
);

// Tool 3: Plan itinerary
server.tool(
  "plan_itinerary",
  `Plan a multi-leg TGVmax itinerary with automatic connection finding.

This is the BEST tool for finding routes between cities that may not have direct TGVmax trains. It:
- Finds direct trains OR trains with 1 connection through intermediate cities
- Searches up to 5 days ahead per leg if no trains on the requested date
- Handles overnight stays at waypoints

Station names are auto-resolved (e.g., "lyon" → "LYON (intramuros)").

USAGE EXAMPLES:
1. Simple A→B trip: plan_itinerary(departure="lyon", arrival="montpellier", start_date="2026-05-14")
2. Round trip: Call twice — once for outbound, once for return.
3. Multi-city: plan_itinerary(departure="lyon", arrival="nice", start_date="2026-05-14", waypoints=[{city:"montpellier", min_nights:2}])

STRATEGY for "maximize time at destination":
- For outbound: use plan_itinerary with earliest possible date/time
- For return: search_trains on the return date and pick the LATEST departure that arrives before your deadline
- Compare different dates to find the optimal combination`,
  {
    departure: z.string().describe("Departure station (auto-resolved, e.g., 'lyon')"),
    arrival: z.string().describe("Final arrival station (auto-resolved, e.g., 'montpellier')"),
    start_date: z.string().describe("Start date in YYYY-MM-DD format"),
    waypoints: z.array(z.object({
      city: z.string().describe("Waypoint station (auto-resolved)"),
      min_nights: z.number().optional().describe("Minimum nights to spend at this waypoint (default: 0)"),
    })).optional().describe("Optional intermediate stops with overnight stays"),
  },
  async ({ departure, arrival, start_date, waypoints }) => {
    try {
      // Auto-resolve station names
      const [resolvedDep] = await resolveStation(departure, start_date);
      const [resolvedArr] = await resolveStation(arrival, start_date);
      const resolvedWaypoints = waypoints ? await Promise.all(
        waypoints.map(async (w) => {
          const [resolved] = await resolveStation(w.city, start_date);
          return { city: resolved, min_nights: w.min_nights };
        })
      ) : undefined;

      const result = await planItinerary({
        departure: resolvedDep,
        arrival: resolvedArr,
        start_date,
        waypoints: resolvedWaypoints,
      });

      if (!result.success) {
        let text = `Could not complete the itinerary.\nError: ${result.error}\n`;
        if (result.segments.length > 0) {
          text += `\nPartial itinerary (${result.segments.length} leg(s) found):\n`;
          for (const seg of result.segments) {
            text += `- ${seg.depart} → ${seg.arrivee} | ${seg.date} ${seg.heure_depart}→${seg.heure_arrivee} | Train ${seg.train_no} (${formatDuration(seg.departure_datetime, seg.arrival_datetime)})\n`;
          }
        }
        return { content: [{ type: "text", text }] };
      }

      let text = `Itinerary planned successfully! ${result.segments.length} leg(s):\n\n`;

      for (let i = 0; i < result.segments.length; i++) {
        const seg = result.segments[i];
        const duration = formatDuration(seg.departure_datetime, seg.arrival_datetime);
        text += `### Leg ${i + 1}: ${seg.depart} → ${seg.arrivee}\n`;
        text += `- Date: ${seg.date}\n`;
        text += `- Departure: ${seg.heure_depart}\n`;
        text += `- Arrival: ${seg.heure_arrivee}\n`;
        text += `- Train: ${seg.train_no}\n`;
        text += `- Duration: ${duration}\n`;

        // Connection time
        if (i < result.segments.length - 1) {
          const nextSeg = result.segments[i + 1];
          const waitDuration = formatDuration(seg.arrival_datetime, nextSeg.departure_datetime);
          text += `- ⏳ Wait at ${seg.arrivee}: ${waitDuration}\n`;
        }
        text += "\n";
      }

      // Total duration
      const first = result.segments[0];
      const last = result.segments[result.segments.length - 1];
      text += `**Total duration: ${formatDuration(first.departure_datetime, last.arrival_datetime)}**\n`;
      text += `**${first.depart} → ${last.arrivee}**\n`;

      return { content: [{ type: "text", text }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
    }
  }
);

// ── MCP Prompt: Travel planning guide ──

server.prompt(
  "plan_trip",
  "Step-by-step guide for planning a TGVmax train trip. Use this when a user asks to find trains or plan a trip.",
  {
    origin: z.string().describe("Departure city (e.g., 'lyon')"),
    destination: z.string().describe("Destination city (e.g., 'montpellier')"),
    outbound_date: z.string().describe("Outbound date YYYY-MM-DD"),
    return_date: z.string().optional().describe("Return date YYYY-MM-DD (if round trip)"),
    earliest_departure: z.string().optional().describe("Earliest departure time HH:MM (e.g., '17:00')"),
    latest_return: z.string().optional().describe("Latest return arrival time HH:MM (e.g., '09:00')"),
  },
  ({ origin, destination, outbound_date, return_date, earliest_departure, latest_return }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `You are helping plan a TGVmax train trip. Follow these steps EXACTLY:

## Context
- TGVmax is a French subscription that allows free travel on eligible trains. This tool searches ONLY TGVmax-eligible trains.
- Origin: ${origin}
- Destination: ${destination}
- Outbound date: ${outbound_date}${earliest_departure ? ` (depart after ${earliest_departure})` : ""}
- ${return_date ? `Return date: ${return_date}${latest_return ? ` (arrive before ${latest_return})` : ""}` : "One-way trip"}

## Step 1: Search outbound trains
Call search_trains with date="${outbound_date}", origin="${origin}", destination="${destination}".
If results found, note all trains${earliest_departure ? ` departing after ${earliest_departure}` : ""}.
If NO results: call plan_itinerary(departure="${origin}", arrival="${destination}", start_date="${outbound_date}") to find connections.

## Step 2: Search return trains
${return_date ? `Call search_trains with date="${return_date}", origin="${destination}", destination="${origin}".
If results found, note all trains${latest_return ? ` arriving before ${latest_return}` : ""}.
If NO results: call plan_itinerary(departure="${destination}", arrival="${origin}", start_date="${return_date}") to find connections.` : "N/A - one-way trip."}

## Step 3: Present the best options
${return_date ? `To maximize time at ${destination}:
- Pick the LATEST outbound that still departs ${earliest_departure ? `after ${earliest_departure}` : "on time"}
- Actually no — pick the EARLIEST outbound to arrive sooner
- Pick the LATEST return${latest_return ? ` that arrives before ${latest_return}` : ""}
- Calculate total hours at ${destination}: return departure time - outbound arrival time` : "Pick the best train based on user preferences."}

Present results in a clear table or list format.`,
      },
    }],
  })
);

// ── Start ──

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

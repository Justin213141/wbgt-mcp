# WBGT MCP Server

## Project Overview
- Cloudflare Workers MCP server for Wet-Bulb Globe Temperature (WBGT) calculations
- Kong et al. zero-iteration analytic implementation with numerical safeguards
- Multi-source weather data: WeatherZone, BOM, Open-Meteo, Visual Crossing

## Tech Stack
- TypeScript on Cloudflare Workers
- MCP SDK for tool integration
- Puppeteer for WeatherZone browser rendering
- Vitest for testing

## Key Commands
```bash
npm run dev          # Local development
npm run deploy       # Deploy to Cloudflare
npm run type-check   # TypeScript validation
npm test             # Run tests
```

## Architecture

### Data Sources (priority order)
1. WeatherZone - Australian real-time observations (browser-rendered)
2. BOM - Bureau of Meteorology official data
3. Open-Meteo - Solar radiation (satellite + model tiers)
4. Visual Crossing - Historical data fallback

### Solar Radiation Tiers
- Tier 1: `satellite_radiation_seamless` (observational satellite data)
- Tier 2: `archive_best_match` (model data)
- Single API call with `models=satellite_radiation_seamless,best_match` and `past_days=3`

### Core Calculations (src/calculations/)
- kong-wbgt.ts - Main WBGT algorithm
- radiation.ts - Solar radiation components
- air-properties.ts - Thermodynamic properties
- vapor-pressure.ts - Humidity calculations

## Current Focus
- WeatherZone + satellite solar radiation integration working
- Two-tier solar radiation routing (satellite_seamless > archive_best_match)
- Location-based WeatherZone station selection

## DO NOT
- Don't use `dateText.includes('T')` for ISO format detection - matches timezone abbreviations like "AEDT"
- Don't make multiple sequential API calls for solar radiation - use single satellite API with both models
- Don't use archive API for recent dates (within 5 days) - it returns 400/429

## API Endpoints
- `/api/observations` - WBGT observations with WeatherZone + solar radiation
- `/api/forecast` - 72-hour WBGT forecast
- `/mcp` - MCP protocol endpoint

## Environment Variables
- `VISUAL_CROSSING_API_KEY` - Historical data API
- `BROWSER` - Cloudflare browser rendering endpoint

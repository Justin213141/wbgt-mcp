/**
 * Bureau of Meteorology (BOM) Weather Station Database
 *
 * This file contains metadata for BOM weather observation stations.
 * Currently includes Sydney metropolitan area and surrounding regions.
 *
 * Data source: https://reg.bom.gov.au/nsw/observations/sydney.shtml
 * Coverage: Past 72 hours of observations
 * Update frequency: Every 10 minutes
 */

export interface BOMStation {
  name: string;        // Station name (e.g., "Sydney Olympic Park AWS")
  code: string;        // Station code (e.g., "95765")
  productId: string;   // BOM product ID (e.g., "IDN60901")
  latitude: number;    // Latitude in decimal degrees
  longitude: number;   // Longitude in decimal degrees
  jsonUrl: string;     // Full JSON endpoint URL for observations
}

/**
 * Sydney metropolitan area and NSW Central Coast weather stations
 * Sorted alphabetically by station name
 */
export const SYDNEY_BOM_STATIONS: BOMStation[] = [
  {
    name: "Badgerys Creek AWS",
    code: "94752",
    productId: "IDN60901",
    latitude: -33.90,
    longitude: 150.73,
    jsonUrl: "http://www.bom.gov.au/fwo/IDN60901/IDN60901.94752.json"
  },
  {
    name: "Bankstown Airport AWS",
    code: "94765",
    productId: "IDN60901",
    latitude: -33.92,
    longitude: 150.98,
    jsonUrl: "http://www.bom.gov.au/fwo/IDN60901/IDN60901.94765.json"
  },
  {
    name: "Bellambi AWS",
    code: "94749",
    productId: "IDN60901",
    latitude: -34.37,
    longitude: 150.93,
    jsonUrl: "http://www.bom.gov.au/fwo/IDN60901/IDN60901.94749.json"
  },
  {
    name: "Camden Airport AWS",
    code: "94755",
    productId: "IDN60901",
    latitude: -34.04,
    longitude: 150.69,
    jsonUrl: "http://www.bom.gov.au/fwo/IDN60901/IDN60901.94755.json"
  },
  {
    name: "Campbelltown (Mount Annan)",
    code: "94757",
    productId: "IDN60901",
    latitude: -34.06,
    longitude: 150.77,
    jsonUrl: "http://www.bom.gov.au/fwo/IDN60901/IDN60901.94757.json"
  },
  {
    name: "Canterbury Racecourse AWS",
    code: "94766",
    productId: "IDN60901",
    latitude: -33.91,
    longitude: 151.11,
    jsonUrl: "http://www.bom.gov.au/fwo/IDN60901/IDN60901.94766.json"
  },
  {
    name: "Fort Denison",
    code: "94769",
    productId: "IDN60901",
    latitude: -33.86,
    longitude: 151.23,
    jsonUrl: "http://www.bom.gov.au/fwo/IDN60901/IDN60901.94769.json"
  },
  {
    name: "Gosford AWS",
    code: "94782",
    productId: "IDN60901",
    latitude: -33.44,
    longitude: 151.36,
    jsonUrl: "http://www.bom.gov.au/fwo/IDN60901/IDN60901.94782.json"
  },
  {
    name: "Holsworthy Aerodrome AWS",
    code: "95761",
    productId: "IDN60901",
    latitude: -33.99,
    longitude: 150.95,
    jsonUrl: "http://www.bom.gov.au/fwo/IDN60901/IDN60901.95761.json"
  },
  {
    name: "Holsworthy Defence AWS",
    code: "95684",
    productId: "IDN60901",
    latitude: -34.08,
    longitude: 150.90,
    jsonUrl: "http://www.bom.gov.au/fwo/IDN60901/IDN60901.95684.json"
  },
  {
    name: "Horsley Park Equestrian Centre AWS",
    code: "94760",
    productId: "IDN60901",
    latitude: -33.85,
    longitude: 150.86,
    jsonUrl: "http://www.bom.gov.au/fwo/IDN60901/IDN60901.94760.json"
  },
  {
    name: "Katoomba (Farnells Rd)",
    code: "94744",
    productId: "IDN60901",
    latitude: -33.71,
    longitude: 150.30,
    jsonUrl: "http://www.bom.gov.au/fwo/IDN60901/IDN60901.94744.json"
  },
  {
    name: "Kurnell AWS",
    code: "95756",
    productId: "IDN60901",
    latitude: -34.00,
    longitude: 151.21,
    jsonUrl: "http://www.bom.gov.au/fwo/IDN60901/IDN60901.95756.json"
  },
  {
    name: "Lake Macquarie AWS",
    code: "95767",
    productId: "IDN60901",
    latitude: -33.09,
    longitude: 151.46,
    jsonUrl: "http://www.bom.gov.au/fwo/IDN60901/IDN60901.95767.json"
  },
  {
    name: "Little Bay (The Coast Golf Club)",
    code: "94780",
    productId: "IDN60901",
    latitude: -33.98,
    longitude: 151.25,
    jsonUrl: "http://www.bom.gov.au/fwo/IDN60901/IDN60901.94780.json"
  },
  {
    name: "Lucas Heights (ANSTO)",
    code: "95757",
    productId: "IDN60901",
    latitude: -34.05,
    longitude: 150.98,
    jsonUrl: "http://www.bom.gov.au/fwo/IDN60901/IDN60901.95757.json"
  },
  {
    name: "Mangrove Mountain AWS",
    code: "95774",
    productId: "IDN60901",
    latitude: -33.29,
    longitude: 151.21,
    jsonUrl: "http://www.bom.gov.au/fwo/IDN60901/IDN60901.95774.json"
  },
  {
    name: "Mount Boyce AWS",
    code: "94743",
    productId: "IDN60901",
    latitude: -33.62,
    longitude: 150.27,
    jsonUrl: "http://www.bom.gov.au/fwo/IDN60901/IDN60901.94743.json"
  },
  {
    name: "Newcastle Nobbys Signal Station AWS",
    code: "94774",
    productId: "IDN60901",
    latitude: -32.92,
    longitude: 151.80,
    jsonUrl: "http://www.bom.gov.au/fwo/IDN60901/IDN60901.94774.json"
  },
  {
    name: "Norah Head AWS",
    code: "95770",
    productId: "IDN60901",
    latitude: -33.28,
    longitude: 151.58,
    jsonUrl: "http://www.bom.gov.au/fwo/IDN60901/IDN60901.95770.json"
  },
  {
    name: "North Head",
    code: "95768",
    productId: "IDN60901",
    latitude: -33.82,
    longitude: 151.30,
    jsonUrl: "http://www.bom.gov.au/fwo/IDN60901/IDN60901.95768.json"
  },
  {
    name: "Parramatta North (Masons Drive)",
    code: "94764",
    productId: "IDN60901",
    latitude: -33.79,
    longitude: 151.02,
    jsonUrl: "http://www.bom.gov.au/fwo/IDN60901/IDN60901.94764.json"
  },
  {
    name: "Penrith Lakes AWS",
    code: "94763",
    productId: "IDN60901",
    latitude: -33.72,
    longitude: 150.68,
    jsonUrl: "http://www.bom.gov.au/fwo/IDN60901/IDN60901.94763.json"
  },
  {
    name: "Richmond RAAF",
    code: "95753",
    productId: "IDN60901",
    latitude: -33.60,
    longitude: 150.78,
    jsonUrl: "http://www.bom.gov.au/fwo/IDN60901/IDN60901.95753.json"
  },
  {
    name: "Sydney Airport AMO",
    code: "94767",
    productId: "IDN60901",
    latitude: -33.95,
    longitude: 151.17,
    jsonUrl: "http://www.bom.gov.au/fwo/IDN60901/IDN60901.94767.json"
  },
  {
    name: "Sydney Harbour (Wedding Cake West)",
    code: "95766",
    productId: "IDN60901",
    latitude: -33.84,
    longitude: 151.26,
    jsonUrl: "http://www.bom.gov.au/fwo/IDN60901/IDN60901.95766.json"
  },
  {
    name: "Sydney Observatory Hill",
    code: "94768",
    productId: "IDN60901",
    latitude: -33.86,
    longitude: 151.20,
    jsonUrl: "http://www.bom.gov.au/fwo/IDN60901/IDN60901.94768.json"
  },
  {
    name: "Sydney Olympic Park AWS (Archery Centre)",
    code: "95765",
    productId: "IDN60901",
    latitude: -33.83,
    longitude: 151.07,
    jsonUrl: "http://www.bom.gov.au/fwo/IDN60901/IDN60901.95765.json"
  },
  {
    name: "Terrey Hills AWS",
    code: "94759",
    productId: "IDN60901",
    latitude: -33.69,
    longitude: 151.23,
    jsonUrl: "http://www.bom.gov.au/fwo/IDN60901/IDN60901.94759.json"
  },
  {
    name: "Wattamolla AWS",
    code: "95752",
    productId: "IDN60901",
    latitude: -34.14,
    longitude: 151.12,
    jsonUrl: "http://www.bom.gov.au/fwo/IDN60901/IDN60901.95752.json"
  },
  {
    name: "Williamtown RAAF",
    code: "94776",
    productId: "IDN60901",
    latitude: -32.79,
    longitude: 151.84,
    jsonUrl: "http://www.bom.gov.au/fwo/IDN60901/IDN60901.94776.json"
  }
];

/**
 * South Coast NSW weather stations
 * Includes Illawarra and South Coast regions
 */
export const SOUTH_COAST_BOM_STATIONS: BOMStation[] = [
  {
    name: "Ulladulla AWS",
    code: "94938",
    productId: "IDN60801",
    latitude: -35.36,
    longitude: 150.48,
    jsonUrl: "http://www.bom.gov.au/fwo/IDN60801/IDN60801.94938.json"
  }
];

/**
 * Default BOM station (Sydney Olympic Park)
 * Matches the current hardcoded station in the codebase
 */
export const DEFAULT_BOM_STATION: BOMStation = SYDNEY_BOM_STATIONS.find(
  station => station.code === "95765"
)!;

/**
 * All BOM stations (Sydney + South Coast NSW)
 */
export const ALL_BOM_STATIONS: BOMStation[] = [
  ...SYDNEY_BOM_STATIONS,
  ...SOUTH_COAST_BOM_STATIONS
];

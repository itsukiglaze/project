export const CALENDAR_QUERY_KEYS = {
  occurrences: (from: string, to: string) => `occurrences:${from}:${to}`,
  occurrencesPrefix: "occurrences:",
  forecast: (days: number) => `forecast:${days}`,
  forecastPrefix: "forecast:",
  seriesList: "series:list",
};

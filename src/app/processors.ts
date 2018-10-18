const IPv4 = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/;

export function processToPosInt(input: string, fallback: string): string {
  let normalized = parseInt(input);

  if (!isNaN(normalized) && normalized > 0) {
    return normalized.toString();
  } else {
    return fallback;
  }
}

export function processToPercent(input: string, fallback: string): string {
  let normalized = parseFloat(input);

  if (isNaN(normalized)) {
    return fallback;
  } else {
    return Math.max(Math.min(normalized, 100), 0).toString();
  }
}

export function processToIp(input: string, fallback: string): string {
  if (IPv4.test(input)) {
    return input;
  } else {
    return fallback;
  }
}

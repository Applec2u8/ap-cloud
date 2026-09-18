/**
 * uaParser.ts
 * Robust client-side User-Agent parser.
 * No external dependencies — pure regex-based detection.
 */

export interface ParsedUA {
  /** Specific device name, e.g. "iPhone (iOS 17.1)", "Samsung SM-S908B", "Windows PC", "Mac" */
  deviceName: string;
  /** Browser name + major version, e.g. "Chrome 128", "Safari 17", "Firefox 120", "Edge 127" */
  browser: string;
  /** Operating system + version, e.g. "iOS 17.1", "Android 13", "Windows 11/10", "macOS 14.2" */
  os: string;
  /** Broad category: "Mobile" | "Tablet" | "Desktop/PC" */
  deviceType: 'Mobile' | 'Tablet' | 'Desktop/PC';
}

export function parseUA(ua: string = navigator.userAgent): ParsedUA {
  // ── Device Type ──────────────────────────────────────────────────────────────
  const isMobile = /Mobi|Android.*Mobile|iPhone|iPod/i.test(ua);
  const isTablet = /iPad|Android(?!.*Mobile)/i.test(ua) || /Tablet/i.test(ua);
  const deviceType: ParsedUA['deviceType'] = isTablet ? 'Tablet' : isMobile ? 'Mobile' : 'Desktop/PC';

  // ── OS Detection ─────────────────────────────────────────────────────────────
  let os = 'Unknown';

  // iOS (iPhone / iPad)
  const iosMatch = ua.match(/(?:iPhone OS|CPU OS)\s*([\d_]+)/i);
  if (iosMatch) {
    const version = iosMatch[1].replace(/_/g, '.');
    os = `iOS ${version}`;
  }

  // Android
  const androidMatch = ua.match(/Android\s*([\d.]+)/i);
  if (androidMatch) {
    os = `Android ${androidMatch[1]}`;
  }

  // Windows
  if (/Windows NT 10\.0/i.test(ua))       os = 'Windows 11/10';
  else if (/Windows NT 6\.3/i.test(ua))   os = 'Windows 8.1';
  else if (/Windows NT 6\.2/i.test(ua))   os = 'Windows 8';
  else if (/Windows NT 6\.1/i.test(ua))   os = 'Windows 7';
  else if (/Windows NT 5\.1/i.test(ua))   os = 'Windows XP';
  else if (/Windows/i.test(ua) && !/Android/i.test(ua)) os = 'Windows';

  // macOS (must exclude iPhone/iPad which also contain "Mac OS X")
  if (/Mac OS X/i.test(ua) && !/iPhone|iPad/i.test(ua)) {
    const macMatch = ua.match(/Mac OS X\s*([\d_.]+)/i);
    const version = macMatch ? macMatch[1].replace(/_/g, '.') : '';
    os = version ? `macOS ${version}` : 'macOS';
  }

  // Linux
  if (/Linux/i.test(ua) && !/Android/i.test(ua) && !/Chrome OS/i.test(ua)) os = 'Linux';
  if (/CrOS/i.test(ua)) os = 'Chrome OS';

  // ── Device Name ───────────────────────────────────────────────────────────────
  let deviceName = 'Unknown Device';

  if (/iPhone/i.test(ua)) {
    const iosVer = iosMatch ? iosMatch[1].replace(/_/g, '.') : '?';
    deviceName = `iPhone (iOS ${iosVer})`;
  } else if (/iPad/i.test(ua)) {
    const iosVer = iosMatch ? iosMatch[1].replace(/_/g, '.') : '?';
    deviceName = `iPad (iOS ${iosVer})`;
  } else if (androidMatch) {
    // Try to extract exact Android model from Build/ tag
    // Pattern: "; Samsung SM-S908B Build/" or "; Pixel 7 Build/"
    const modelMatch = ua.match(/;\s*([^;()]+?)\s*(?:Build\/|[);\s])/);
    if (modelMatch) {
      const raw = modelMatch[1].trim();
      // Skip common noise strings
      if (!/^Linux|^Android|^wv$|^Mobile/i.test(raw) && raw.length > 2) {
        deviceName = `${raw} (Android ${androidMatch[1]})`;
      } else {
        deviceName = `Android ${androidMatch[1]}`;
      }
    } else {
      deviceName = `Android ${androidMatch[1]}`;
    }
  } else if (/Windows/i.test(ua)) {
    deviceName = 'Windows PC';
  } else if (/Mac OS X/i.test(ua)) {
    deviceName = 'Mac';
  } else if (/CrOS/i.test(ua)) {
    deviceName = 'Chromebook';
  } else if (/Linux/i.test(ua)) {
    deviceName = 'Linux PC';
  }

  // ── Browser Detection ────────────────────────────────────────────────────────
  let browser = 'Unknown';

  // Order matters: Edge must come before Chrome, Opera before Chrome
  const edgeMatch    = ua.match(/Edg(?:e|)\/([\d.]+)/i);
  const operaMatch   = ua.match(/OPR\/([\d.]+)/i);
  const samsungMatch = ua.match(/SamsungBrowser\/([\d.]+)/i);
  const chromeMatch  = ua.match(/(?:Chrome|CriOS)\/([\d.]+)/i);
  const firefoxMatch = ua.match(/(?:Firefox|FxiOS)\/([\d.]+)/i);
  const safariMatch  = ua.match(/Version\/([\d.]+).*Safari/i);

  if (samsungMatch)      browser = `Samsung Internet ${samsungMatch[1].split('.')[0]}`;
  else if (edgeMatch)    browser = `Edge ${edgeMatch[1].split('.')[0]}`;
  else if (operaMatch)   browser = `Opera ${operaMatch[1].split('.')[0]}`;
  else if (firefoxMatch) browser = `Firefox ${firefoxMatch[1].split('.')[0]}`;
  else if (chromeMatch)  browser = `Chrome ${chromeMatch[1].split('.')[0]}`;
  else if (safariMatch)  browser = `Safari ${safariMatch[1].split('.')[0]}`;

  return { deviceName, browser, os, deviceType };
}

/** Convenience: returns a compact label combining device + browser for display */
export function deviceLabel(parsed: ParsedUA): string {
  return `${parsed.deviceName} — ${parsed.browser}`;
}

function detectOSInfoFromUa(ua) {
  let osName = "unknown";
  let osVersion = "unknown";

  if (/Windows NT/.test(ua)) {
    osName = "Windows";
    const match = ua.match(/Windows NT ([\d.]+)/);
    if (match) {
      const versions = { "10.0": "10", "6.3": "8.1", "6.2": "8", "6.1": "7" };
      osVersion = versions[match[1]] || match[1];
    }
  } else if (/Mac OS X/.test(ua)) {
    osName = "macOS";
    const match = ua.match(/Mac OS X ([\d_]+)/);
    if (match) {
      osVersion = match[1].replace(/_/g, ".");
      if (osVersion === "10.15.7") {
        osVersion = "10.15.7+";
      }
    }
  } else if (/iPhone|iPad/.test(ua)) {
    osName = /iPhone/.test(ua) ? "iOS" : "iPadOS";
    const match = ua.match(/OS ([\d_]+)/);
    if (match) osVersion = match[1].replace(/_/g, ".");
  } else if (/Android/.test(ua)) {
    osName = "Android";
    const match = ua.match(/Android ([\d.]+)/);
    if (match) osVersion = match[1];
  } else if (/Linux/.test(ua)) {
    osName = "Linux";
  }

  return { osName, osVersion, osInfo: `${osName}-${osVersion}` };
}

function detectBrowserInfoFromUa(ua) {
  let browserName = "unknown";
  let browserVersion = "unknown";

  // Detect browser
  if (/Arc\//.test(ua)) {
    browserName = "Arc";
    const match = ua.match(/Arc\/([\d.]+)/);
    if (match) browserVersion = match[1];
  } else if (/EdgA\//.test(ua)) {
    browserName = "Edge Android";
    const match = ua.match(/EdgA\/([\d.]+)/);
    if (match) browserVersion = match[1];
  } else if (/EdgiOS\//.test(ua)) {
    browserName = "Edge iOS";
    const match = ua.match(/EdgiOS\/([\d.]+)/);
    if (match) browserVersion = match[1];
  } else if (/Edg\//.test(ua)) {
    browserName = "Edge";
    const match = ua.match(/Edg\/([\d.]+)/);
    if (match) browserVersion = match[1];
  } else if (/CriOS\//.test(ua)) {
    browserName = "Chrome iOS";
    const match = ua.match(/CriOS\/([\d.]+)/);
    if (match) browserVersion = match[1];
  } else if (/FxiOS\//.test(ua)) {
    browserName = "Firefox iOS";
    const match = ua.match(/FxiOS\/([\d.]+)/);
    if (match) browserVersion = match[1];
  } else if (/Chrome/.test(ua) && !/Edg/.test(ua)) {
    browserName = "Chrome";
    const match = ua.match(/Chrome\/([\d.]+)/);
    if (match) browserVersion = match[1];
  } else if (/Vivaldi\//.test(ua)) {
    browserName = "Vivaldi";
    const match = ua.match(/Vivaldi\/([\d.]+)/);
    if (match) browserVersion = match[1];
  } else if (/Safari/.test(ua) && !/Chrome/.test(ua)) {
    browserName = "Safari";
    const match = ua.match(/Version\/([\d.]+)/);
    if (match) browserVersion = match[1];
  } else if (/Firefox/.test(ua)) {
    browserName = "Firefox";
    const match = ua.match(/Firefox\/([\d.]+)/);
    if (match) browserVersion = match[1];
  } else if (/Opera|OPR/.test(ua)) {
    browserName = "Opera";
    const match = ua.match(/(?:Opera|OPR)\/([\d.]+)/);
    if (match) browserVersion = match[1];
  }

  return { browserName, browserVersion };
}

function detectDeviceModelFromUa(ua) {
  let deviceModel = "unknown";

  if (/iPhone/.test(ua)) {
    deviceModel = "iPhone";
  } else if (/iPad/.test(ua)) {
    deviceModel = "iPad";
  } else if (/Android/.test(ua)) {
    const match = ua.match(/;\s*([^;)]+)\s+Build\//);
    if (match && match[1]) {
      deviceModel = match[1].trim();
    } else {
      deviceModel = "Android Device";
    }
  } else if (/Macintosh/.test(ua)) {
    deviceModel = "Mac";
  } else if (/Windows/.test(ua)) {
    deviceModel = "PC";
  } else if (/Linux/.test(ua)) {
    deviceModel = "Linux PC";
  }

  return deviceModel;
}

export function getUaDerivedInfo({ ua, isBrave } = {}) {
  const { osName, osVersion, osInfo } = detectOSInfoFromUa(ua);

  if (isBrave) {
    let browserVersion = "unknown";
    const braveMatch = ua.match(/Chrome\/([\d.]+)/);
    if (braveMatch) browserVersion = braveMatch[1];
    return {
      osName,
      osVersion,
      osInfo,
      browserName: "Brave",
      browserVersion,
      deviceModel: detectDeviceModelFromUa(ua),
    };
  }

  const { browserName, browserVersion } = detectBrowserInfoFromUa(ua);
  return {
    osName,
    osVersion,
    osInfo,
    browserName,
    browserVersion,
    deviceModel: detectDeviceModelFromUa(ua),
  };
}

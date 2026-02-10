// Tracked websites configuration
const TRACKED_SITES = [
  { hostname: "axiom.trade", name: "Axiom" },
  { hostname: "trade.padre.gg", name: "Terminal" },
  { hostname: "gmgn.ai", name: "Gmgn" },
];

// Default settings
const DEFAULT_SETTINGS = {
  enabledPlatforms: {
    "axiom.trade": true,
    "trade.padre.gg": false,
    "gmgn.ai": false,
  },
};

// Track active tab and time
let activeTabId = null;
let currentSite = null;
let lastUpdateTime = Date.now();
let intervalId = null;
let enabledPlatforms = DEFAULT_SETTINGS.enabledPlatforms;

// Initialize storage with default values
async function initializeStorage() {
  const data = await chrome.storage.local.get(["timeData", "settings"]);

  // Initialize time data
  if (!data.timeData) {
    const initialData = {};
    TRACKED_SITES.forEach((site) => {
      initialData[site.hostname] = {
        name: site.name,
        totalMinutes: 0,
      };
    });
    await chrome.storage.local.set({ timeData: initialData });
  }

  // Initialize settings and load enabled platforms
  if (!data.settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
    enabledPlatforms = DEFAULT_SETTINGS.enabledPlatforms;
  } else {
    enabledPlatforms =
      data.settings.enabledPlatforms || DEFAULT_SETTINGS.enabledPlatforms;
  }
}

// Check if URL matches tracked sites AND is enabled
function getTrackedSite(url) {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    const site = TRACKED_SITES.find(
      (site) => urlObj.hostname === site.hostname,
    );

    // Only return site if it's enabled in settings
    if (site && enabledPlatforms[site.hostname]) {
      return site;
    }
    return null;
  } catch (e) {
    return null;
  }
}

// Update enabled platforms from settings
async function updateEnabledPlatforms() {
  const data = await chrome.storage.local.get(["settings"]);
  if (data.settings && data.settings.enabledPlatforms) {
    enabledPlatforms = data.settings.enabledPlatforms;
  }
}

// Update time for current site
async function updateTime() {
  if (!currentSite) return;

  const now = Date.now();
  const elapsedMinutes = Math.floor((now - lastUpdateTime) / 60000);

  if (elapsedMinutes >= 1) {
    const data = await chrome.storage.local.get(["timeData"]);
    const timeData = data.timeData || {};

    if (!timeData[currentSite.hostname]) {
      timeData[currentSite.hostname] = {
        name: currentSite.name,
        totalMinutes: 0,
      };
    }

    timeData[currentSite.hostname].totalMinutes += elapsedMinutes;
    await chrome.storage.local.set({ timeData });
    lastUpdateTime = now;
  }
}

// Start tracking
function startTracking(site) {
  if (currentSite?.hostname === site?.hostname) return;

  stopTracking();
  currentSite = site;
  lastUpdateTime = Date.now();

  if (site) {
    // Update every 10 seconds
    intervalId = setInterval(updateTime, 10000);
  }
}

// Stop tracking
function stopTracking() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (currentSite) {
    updateTime(); // Final update before stopping
  }
  currentSite = null;
}

// Handle tab activation
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  activeTabId = activeInfo.tabId;
  const tab = await chrome.tabs.get(activeTabId);

  // Check if tab is visible (not minimized)
  const window = await chrome.windows.get(tab.windowId);
  if (window.state === "minimized") {
    stopTracking();
    return;
  }

  const site = getTrackedSite(tab.url);
  startTracking(site);
});

// Handle tab updates (URL changes)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tabId === activeTabId && changeInfo.url) {
    const site = getTrackedSite(changeInfo.url);
    startTracking(site);
  }
});

// Handle window focus changes
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Browser lost focus
    stopTracking();
  } else {
    // Browser gained focus, check active tab
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    if (tab) {
      activeTabId = tab.id;
      const site = getTrackedSite(tab.url);
      startTracking(site);
    }
  }
});

// Handle visibility changes (tab hidden/shown)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  const window = await chrome.windows.get(tab.windowId);

  if (window.state === "minimized") {
    stopTracking();
  } else {
    const site = getTrackedSite(tab.url);
    startTracking(site);
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "updateEnabledPlatforms") {
    enabledPlatforms = message.enabledPlatforms;

    // Re-check current tab to stop tracking if platform was disabled
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        const site = getTrackedSite(tabs[0].url);
        if (!site) {
          // Current site is no longer tracked, stop tracking
          stopTracking();
        } else if (currentSite?.hostname !== site.hostname) {
          // Start tracking new site
          startTracking(site);
        }
      }
    });
  }
});

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  initializeStorage();
});

// Initialize on startup
chrome.runtime.onStartup.addListener(() => {
  initializeStorage();
});

// Initialize immediately
initializeStorage();

// Get current tab and start tracking if applicable
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]) {
    activeTabId = tabs[0].id;
    const site = getTrackedSite(tabs[0].url);
    startTracking(site);
  }
});

// Default settings
const DEFAULT_SETTINGS = {
  theme: "default",
  customBgImage: null,
  enabledPlatforms: {
    "axiom.trade": true,
    "trade.padre.gg": false,
    "gmgn.ai": false,
  },
};

// Format time
function formatTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

// Load settings from storage
async function loadSettings() {
  try {
    const data = await chrome.storage.local.get(["settings"]);
    return data.settings || DEFAULT_SETTINGS;
  } catch (error) {
    console.error("Error loading settings:", error);
    return DEFAULT_SETTINGS;
  }
}

// Save settings to storage
async function saveSettings(settings) {
  try {
    await chrome.storage.local.set({ settings });
  } catch (error) {
    console.error("Error saving settings:", error);
  }
}

// Apply theme to container
function applyTheme(settings) {
  const container = document.getElementById("container");

  // Remove all theme attributes
  container.removeAttribute("data-theme");
  container.classList.remove("has-custom-bg");
  container.style.backgroundImage = "";

  // Apply custom image if set
  if (settings.customBgImage) {
    container.style.backgroundImage = `url(${settings.customBgImage})`;
    container.classList.add("has-custom-bg");
  }
  // Apply theme color
  else if (settings.theme && settings.theme !== "default") {
    container.setAttribute("data-theme", settings.theme);
  }

  // Update select element value
  const select = document.getElementById("bgSelect");
  if (select) {
    select.value = settings.theme || "default";
  }

  // Show/hide clear image button
  const clearBtn = document.getElementById("clearImgBtn");
  if (settings.customBgImage) {
    clearBtn.style.display = "block";
  } else {
    clearBtn.style.display = "none";
  }
}

// Update visible platforms
function updateVisiblePlatforms(settings) {
  const platforms = [
    { hostname: "axiom.trade", id: "time-axiom" },
    { hostname: "trade.padre.gg", id: "time-terminal" },
    { hostname: "gmgn.ai", id: "time-gmgn" },
  ];

  platforms.forEach((platform) => {
    const card = document.querySelector(
      `.stat-card[data-site="${platform.hostname}"]`,
    );
    const checkbox = document.querySelector(
      `.platform-toggle[data-platform="${platform.hostname}"]`,
    );

    if (card) {
      if (settings.enabledPlatforms[platform.hostname]) {
        card.style.display = "flex";
      } else {
        card.style.display = "none";
      }
    }

    if (checkbox) {
      checkbox.checked = settings.enabledPlatforms[platform.hostname];
    }
  });
}

// Load and display time data
async function loadTimeData() {
  try {
    const [timeDataResult, settingsResult] = await Promise.all([
      chrome.storage.local.get(["timeData"]),
      chrome.storage.local.get(["settings"]),
    ]);

    const timeData = timeDataResult.timeData || {};
    const settings = settingsResult.settings || DEFAULT_SETTINGS;

    // Update Axiom
    if (timeData["axiom.trade"]) {
      document.getElementById("time-axiom").textContent = formatTime(
        timeData["axiom.trade"].totalMinutes || 0,
      );
    }

    // Update Terminal
    if (timeData["trade.padre.gg"]) {
      document.getElementById("time-terminal").textContent = formatTime(
        timeData["trade.padre.gg"].totalMinutes || 0,
      );
    }

    // Update Gmgn
    if (timeData["gmgn.ai"]) {
      document.getElementById("time-gmgn").textContent = formatTime(
        timeData["gmgn.ai"].totalMinutes || 0,
      );
    }
  } catch (error) {
    console.error("Error loading time data:", error);
  }
}

// Reset all data
async function resetAllData() {
  const confirmed = confirm(
    "Are you sure you want to reset all time tracking data? This action cannot be undone.",
  );

  if (confirmed) {
    try {
      const resetData = {
        "axiom.trade": { name: "Axiom", totalMinutes: 0 },
        "trade.padre.gg": { name: "Terminal", totalMinutes: 0 },
        "gmgn.ai": { name: "Gmgn", totalMinutes: 0 },
      };

      await chrome.storage.local.set({ timeData: resetData });
      loadTimeData();
    } catch (error) {
      console.error("Error resetting data:", error);
    }
  }
}

// Handle background image upload
async function handleImageUpload(file) {
  if (!file || !file.type.startsWith("image/")) {
    alert("Please select a valid image");
    return;
  }

  const reader = new FileReader();
  reader.onload = async function (e) {
    const settings = await loadSettings();
    settings.customBgImage = e.target.result;
    settings.theme = "default"; // Reset theme when using custom image
    await saveSettings(settings);
    applyTheme(settings);
  };
  reader.readAsDataURL(file);
}

// Clear custom background image
async function clearCustomImage() {
  const settings = await loadSettings();
  settings.customBgImage = null;
  await saveSettings(settings);
  applyTheme(settings);
}

// Toggle settings panel
function toggleSettingsPanel() {
  const panel = document.getElementById("settingsPanel");
  if (panel.style.display === "none") {
    panel.style.display = "block";
  } else {
    panel.style.display = "none";
  }
}

// Initialize popup
document.addEventListener("DOMContentLoaded", async () => {
  const settings = await loadSettings();

  // Apply initial settings
  applyTheme(settings);
  updateVisiblePlatforms(settings);
  loadTimeData();

  // Settings button
  document.getElementById("settingsBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    toggleSettingsPanel();
  });

  // Background theme select
  document.getElementById("bgSelect").addEventListener("change", async (e) => {
    const theme = e.target.value;
    const settings = await loadSettings();
    settings.theme = theme;
    settings.customBgImage = null; // Clear custom image when selecting theme
    await saveSettings(settings);
    applyTheme(settings);
  });

  // Upload image button
  document.getElementById("uploadBtn").addEventListener("click", () => {
    document.getElementById("bgImageInput").click();
  });

  document.getElementById("bgImageInput").addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      handleImageUpload(e.target.files[0]);
    }
  });

  // Clear image button
  document.getElementById("clearImgBtn").addEventListener("click", () => {
    clearCustomImage();
  });

  // Platform toggles
  document.querySelectorAll(".platform-toggle").forEach((checkbox) => {
    checkbox.addEventListener("change", async (e) => {
      const platform = e.target.getAttribute("data-platform");
      const settings = await loadSettings();
      settings.enabledPlatforms[platform] = e.target.checked;
      await saveSettings(settings);
      updateVisiblePlatforms(settings);

      // Notify background script to update tracking
      chrome.runtime.sendMessage({
        type: "updateEnabledPlatforms",
        enabledPlatforms: settings.enabledPlatforms,
      });
    });
  });

  // Reset button
  document.getElementById("resetBtn").addEventListener("click", () => {
    resetAllData();
  });

  // Close settings panel when clicking outside
  document.addEventListener("click", (e) => {
    const panel = document.getElementById("settingsPanel");
    const settingsBtn = document.getElementById("settingsBtn");

    if (
      panel.style.display === "block" &&
      !panel.contains(e.target) &&
      !settingsBtn.contains(e.target)
    ) {
      panel.style.display = "none";
    }
  });

  // Prevent settings panel clicks from closing it
  document.getElementById("settingsPanel").addEventListener("click", (e) => {
    e.stopPropagation();
  });

  // Refresh data every second while popup is open
  setInterval(loadTimeData, 1000);
});

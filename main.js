const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  nativeImage,
  dialog,
} = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const { uIOhook, UiohookKey } = require("uiohook-napi");
const { spawn, execSync } = require("child_process");

// Store setup
let store;
async function initStore() {
  const { default: Store } = await import("electron-store");
  store = new Store({
    defaults: {
      shortcuts: [],
      stats: {
        expansions: 0,
        charsSaved: 0,
      },
      settings: {
        startWithWindows: false,
        startMinimized: false,
        playSound: true,
        caseSensitive: false,
      },
    },
  });
}

let mainWindow;
let tray;

// --- PowerShell Input Simulation ---
function sendKeys(keys) {
  try {
    // Escape for PowerShell command line
    const safeKeys = keys.replace(/'/g, "''").replace(/"/g, '\\"');
    const cmd = `powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${safeKeys}')"`;
    execSync(cmd, { windowsHide: true });
  } catch (err) {
    console.error("SendKeys error:", err);
  }
}

function escapeForSendKeys(text) {
  // SendKeys special chars: + ^ % ~ ( ) { } [ ]
  return text.replace(/([+\^%~(){}[\]])/g, "{$1}");
}

// --- Key Mapping ---
const keyMap = {
  [UiohookKey.Code0]: "0",
  [UiohookKey.Code1]: "1",
  [UiohookKey.Code2]: "2",
  [UiohookKey.Code3]: "3",
  [UiohookKey.Code4]: "4",
  [UiohookKey.Code5]: "5",
  [UiohookKey.Code6]: "6",
  [UiohookKey.Code7]: "7",
  [UiohookKey.Code8]: "8",
  [UiohookKey.Code9]: "9",
  [UiohookKey.A]: "a",
  [UiohookKey.B]: "b",
  [UiohookKey.C]: "c",
  [UiohookKey.D]: "d",
  [UiohookKey.E]: "e",
  [UiohookKey.F]: "f",
  [UiohookKey.G]: "g",
  [UiohookKey.H]: "h",
  [UiohookKey.I]: "i",
  [UiohookKey.J]: "j",
  [UiohookKey.K]: "k",
  [UiohookKey.L]: "l",
  [UiohookKey.M]: "m",
  [UiohookKey.N]: "n",
  [UiohookKey.O]: "o",
  [UiohookKey.P]: "p",
  [UiohookKey.Q]: "q",
  [UiohookKey.R]: "r",
  [UiohookKey.S]: "s",
  [UiohookKey.T]: "t",
  [UiohookKey.U]: "u",
  [UiohookKey.V]: "v",
  [UiohookKey.W]: "w",
  [UiohookKey.X]: "x",
  [UiohookKey.Y]: "y",
  [UiohookKey.Z]: "z",
  [UiohookKey.Semicolon]: ";",
  [UiohookKey.Space]: " ",
  [UiohookKey.Minus]: "-",
  [UiohookKey.Equal]: "=",
  [UiohookKey.BracketLeft]: "[",
  [UiohookKey.BracketRight]: "]",
  [UiohookKey.Backslash]: "\\",
  [UiohookKey.Quote]: "'",
  [UiohookKey.Comma]: ",",
  [UiohookKey.Period]: ".",
  [UiohookKey.Slash]: "/",
  [UiohookKey.Backcheck]: "`",
};
// Note: This map handles unshifted keys. For a simple ";mail" detector, likely fine.

// --- Buffer & Detection ---
let inputBuffer = [];
const MAX_BUFFER = 50;

uIOhook.on("keydown", (e) => {
  if (!store) return; // Basic safety

  if (e.keycode === UiohookKey.Backspace) {
    inputBuffer.pop();
    return;
  }

  const char = keyMap[e.keycode];
  if (char) {
    inputBuffer.push(char);
    if (inputBuffer.length > MAX_BUFFER) {
      inputBuffer.shift(); // Keep last N
    }
    checkShortcuts();
  }
});

function checkShortcuts() {
  const textInfo = inputBuffer.join("");
  const shortcuts = store.get("shortcuts");
  const settings = store.get("settings");

  for (const s of shortcuts) {
    const isMatch = settings.caseSensitive
      ? textInfo.endsWith(s.trigger)
      : textInfo.toLowerCase().endsWith(s.trigger.toLowerCase());

    if (isMatch) {
      performExpansion(s);
      break;
    }
  }
}

function performExpansion(shortcut) {
  // 1. Clear buffer to prevent re-triggering
  inputBuffer = [];

  // 2. Calculate backspaces needed
  const backspaceCount = shortcut.trigger.length;
  let cmdString = "";
  for (let i = 0; i < backspaceCount; i++) {
    cmdString += "{BACKSPACE}";
  }

  // 3. Add expansion text
  cmdString += escapeForSendKeys(shortcut.expansion);

  // 4. Update stats
  const currentStats = store.get("stats");
  const charsSavedThisTime = Math.max(
    0,
    shortcut.expansion.length - shortcut.trigger.length,
  );
  const newStats = {
    expansions: currentStats.expansions + 1,
    charsSaved: currentStats.charsSaved + charsSavedThisTime,
  };
  store.set("stats", newStats);

  // 5. Notify renderer about stats update
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send("stats-updated", newStats);
    
    // 6. Play sound if enabled
    const settings = store.get("settings");
    if (settings && settings.playSound) {
      mainWindow.webContents.send("play-sound");
    }
  }

  // 7. Send keys
  sendKeys(cmdString);
}

// --- App Lifecycle ---
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    show: false, // Wait until ready
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
    icon: path.join(__dirname, "assets/icon.ico"),
  });

  mainWindow.loadFile("index.html");

  mainWindow.once("ready-to-show", () => {
    const settings = store.get("settings");
    if (settings && settings.startMinimized) {
      // Keep hidden
      console.log("Starting minimized to tray...");
    } else {
      mainWindow.show();
    }
  });

  // Minimize to tray
  mainWindow.on("close", (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });
}

// Generate tray icon
function createTrayIcon() {
  const iconPath = path.join(__dirname, "assets/tray-icon.ico");
  const icon = nativeImage.createFromPath(iconPath);
  return icon.isEmpty()
    ? nativeImage.createFromDataURL(
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==",
      )
    : icon;
}

app.whenReady().then(async () => {
  await initStore();

  // Sync "Start with Windows" setting on startup
  const settings = store.get("settings");
  if (settings) {
    const options = {
      openAtLogin: settings.startWithWindows,
      path: app.getPath("exe"),
    };
    if (!app.isPackaged) {
      options.args = [path.resolve(app.getAppPath())];
    }
    app.setLoginItemSettings(options);
  }

  createWindow();

  tray = new Tray(createTrayIcon());
  const contextMenu = Menu.buildFromTemplate([
    { label: "Show Dashboard", click: () => mainWindow.show() },
    { label: "Check for Updates", click: () => checkForUpdatesManual() },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.isQuiting = true;
        uIOhook.stop();
        app.quit();
      },
    },
  ]);
  tray.setToolTip("Ghost Typer");
  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });

  // Start Hook
  uIOhook.start();

  // Auto Update Setup
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", () => {
    console.log("Update available.");
  });

  autoUpdater.on("update-downloaded", (info) => {
    dialog
      .showMessageBox({
        type: "info",
        title: "Update Ready",
        message:
          "A new version has been downloaded. Restart the application to apply the update?",
        buttons: ["Restart", "Later"],
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
  });

  autoUpdater.on("error", (err) => {
    console.error("Update error:", err);
  });

  // Check for updates every 2 hours
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 2 * 60 * 60 * 1000);

  // Initial check
  autoUpdater.checkForUpdatesAndNotify();
});

// Tray update check
function checkForUpdatesManual() {
  autoUpdater
    .checkForUpdatesAndNotify()
    .then((result) => {
      // If result is null or no update info, it might mean we are current
      // Note: checkForUpdatesAndNotify handles the update available case
    })
    .catch((err) => {
      dialog.showErrorBox(
        "Update Error",
        "Could not check for updates: " + err.message,
      );
    });
}

// IPC Handlers
ipcMain.handle("add-shortcut", (event, s) => {
  const shortcuts = store.get("shortcuts");
  shortcuts.push(s);
  store.set("shortcuts", shortcuts);
  mainWindow.webContents.send("shortcuts-updated", shortcuts);
  return shortcuts;
});

ipcMain.handle("delete-shortcut", (event, trigger) => {
  let shortcuts = store.get("shortcuts");
  shortcuts = shortcuts.filter((s) => s.trigger !== trigger);
  store.set("shortcuts", shortcuts);
  mainWindow.webContents.send("shortcuts-updated", shortcuts);
  return shortcuts;
});

ipcMain.handle("update-shortcut", (event, oldTrigger, newData) => {
  let shortcuts = store.get("shortcuts");
  const index = shortcuts.findIndex((s) => s.trigger === oldTrigger);
  if (index !== -1) {
    shortcuts[index] = newData;
    store.set("shortcuts", shortcuts);
    mainWindow.webContents.send("shortcuts-updated", shortcuts);
  }
  return shortcuts;
});

ipcMain.handle("get-shortcuts", () => {
  return store.get("shortcuts");
});

ipcMain.handle("get-stats", () => {
  return store.get("stats");
});

ipcMain.handle("get-settings", () => {
  return store.get("settings");
});

ipcMain.handle("update-settings", (event, newSettings) => {
  store.set("settings", newSettings);

  // Apply "Start with Windows"
  const options = {
    openAtLogin: newSettings.startWithWindows,
    path: app.getPath("exe"),
  };

  // If in development, we need to pass the app path as an argument
  if (!app.isPackaged) {
    options.args = [path.resolve(app.getAppPath())];
  }

  app.setLoginItemSettings(options);

  return newSettings;
});

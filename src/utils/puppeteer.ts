/**
 * Puppeteer utility functions for browser automation, navigation, and recovery
 */
import puppeteer, { type Browser, type Page } from "puppeteer-core";
import { Launcher } from "chrome-launcher";
import { promises as fs } from "fs";
import { CONFIG } from "../server/config.js";
import type { PuppeteerContext, RecoveryContext } from "../types/index.js";
import { logError, logInfo, logWarn } from "./logging.js";
import {
  analyzeError,
  calculateRetryDelay,
  determineRecoveryLevel,
  generateBrowserArgs,
  getCaptchaSelectors,
  getSearchInputSelectors,
} from "./puppeteer-logic.js";

/**
 * Detects the local Chrome or Edge executable path
 */
export function getLocalBrowserPath(): string | undefined {
  try {
    const installations = Launcher.getInstallations();
    if (installations.length > 0) {
      logInfo(`Detected local browser: ${installations[0]}`);
      return installations[0];
    }
  } catch (error) {
    logWarn(`Failed to detect local browser via chrome-launcher: ${error}`);
  }

  // Fallback paths for Windows
  if (process.platform === "win32") {
    const commonPaths = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    ];
    for (const path of commonPaths) {
      try {
        return path;
      } catch { /* ignore */ }
    }
  }
  
  return undefined;
}

export async function initializeBrowser(ctx: PuppeteerContext, headless = true) {
  if (ctx.isInitializing) {
    logInfo("Browser initialization already in progress...");
    return;
  }
  ctx.setIsInitializing(true);
  try {
    if (ctx.browser) {
      await ctx.browser.close();
    }
    
    const executablePath = getLocalBrowserPath();
    if (!executablePath) {
      throw new Error("No local Chrome or Edge installation found. Please install a browser to use Pepe.");
    }

    let browserArgs = generateBrowserArgs(CONFIG.USER_AGENT);

    // Remove GPU-disabling flags when in non-headless mode (needed for rendering)
    if (!headless) {
      browserArgs = browserArgs.filter(arg =>
        !arg.includes('--disable-gpu') &&
        !arg.includes('--disable-accelerated-2d-canvas')
      );
    }

    const browser = await puppeteer.launch({
      executablePath,
      headless,
      args: browserArgs,
      userDataDir: CONFIG.USE_PERSISTENT_PROFILE ? CONFIG.BROWSER_DATA_DIR : undefined,
    });
    ctx.setBrowser(browser as any);
    const page = await browser.newPage();
    ctx.setPage(page as any);
    await setupBrowserEvasion(ctx);
    await page.setViewport({
      width: 1280,
      height: 720,
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
    });
    await page.setUserAgent(CONFIG.USER_AGENT);
    page.setDefaultNavigationTimeout(CONFIG.PAGE_TIMEOUT);

    if (CONFIG.USE_PERSISTENT_PROFILE) {
      logInfo(`Browser initialized with persistent profile at: ${CONFIG.BROWSER_DATA_DIR}`);
    } else {
      logInfo("Browser initialized (anonymous mode)");
    }
  } catch (error) {
    logError(`Browser initialization failed: ${error}`);
    if (ctx.browser) {
      try {
        await ctx.browser.close();
      } catch (closeError) {
        logError(`Failed to close browser after initialization error: ${closeError}`);
      }
      ctx.setBrowser(null);
    }
    ctx.setPage(null);
    throw new Error(
      `Page not initialized: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    ctx.setIsInitializing(false);
  }
}

// Helper functions for navigation
async function performInitialNavigation(page: Page): Promise<void> {
  try {
    await page.goto("https://www.perplexity.ai/", {
      waitUntil: "domcontentloaded",
      timeout: CONFIG.PAGE_TIMEOUT,
    });
    const isInternalError = await page.evaluate(() => {
      return document.querySelector("main")?.textContent?.includes("internal error") ?? false;
    });
    if (isInternalError) {
      throw new Error("Perplexity.ai returned internal error page");
    }
  } catch (gotoError) {
    if (
      gotoError instanceof Error &&
      !gotoError.message.toLowerCase().includes("timeout") &&
      !gotoError.message.includes("internal error")
    ) {
      logError(`Initial navigation request failed: ${gotoError}`);
      throw gotoError;
    }
    logWarn(
      `Navigation issue detected: ${gotoError instanceof Error ? gotoError.message : String(gotoError)}`,
    );
  }
}

async function validatePageState(page: Page): Promise<void> {
  if (page.isClosed() || page.mainFrame().isDetached()) {
    logError("Page closed or frame detached immediately after navigation attempt.");
    throw new Error("Frame detached during navigation");
  }
}

async function waitForAndValidateSearchInput(ctx: PuppeteerContext): Promise<void> {
  const { page } = ctx;
  if (!page) throw new Error("Page not initialized");

  const searchInput = await waitForSearchInput(ctx);
  if (!searchInput) {
    logError("Search input not found after navigation");
    throw new Error(
      "Search input not found after navigation - page might not have loaded correctly",
    );
  }
}

async function validateFinalPageState(page: Page): Promise<void> {
  let pageUrl = "N/A";
  try {
    if (!page.isClosed()) {
      pageUrl = page.url();
    }
  } catch { /* ignore */ }

  if (pageUrl !== "N/A" && !pageUrl.includes("perplexity.ai")) {
    logError(`Unexpected URL: ${pageUrl}`);
    throw new Error(`Navigation redirected to unexpected URL: ${pageUrl}`);
  }
}

async function handleNavigationFailure(page: Page, error: unknown): Promise<never> {
  logError(`Navigation failed: ${error}`);
  const shouldCaptureScreenshot = CONFIG.DEBUG.CAPTURE_SCREENSHOTS && !isRecoverableError(error);

  if (shouldCaptureScreenshot) {
    try {
      if (page && !page.isClosed()) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const screenshotPath = `debug_navigation_failed_${timestamp}.png` as any;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        logInfo(`Captured screenshot of failed navigation state: ${screenshotPath}`);
      }
    } catch (screenshotError) {
      logError(`Failed to capture screenshot: ${screenshotError}`);
    }
  }
  throw error;
}

function isRecoverableError(error: unknown): boolean {
  if (!error) return false;
  const errorMsg = typeof error === "string" ? error : (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    errorMsg.includes("search input not found") ||
    errorMsg.includes("captcha") ||
    errorMsg.includes("timeout") ||
    errorMsg.includes("navigation")
  );
}

export async function navigateToPerplexity(ctx: PuppeteerContext) {
  const { page } = ctx;
  if (!page) throw new Error("Page not initialized");

  try {
    logInfo("Navigating to Perplexity.ai...");
    await performInitialNavigation(page as any);
    await validatePageState(page as any);
    await waitForAndValidateSearchInput(ctx);
    await validateFinalPageState(page as any);
    logInfo("Navigation and readiness check completed successfully");
  } catch (error) {
    await handleNavigationFailure(page as any, error);
  }
}

export async function setupBrowserEvasion(ctx: PuppeteerContext) {
  const { page } = ctx;
  if (!page) return;
  await page.evaluateOnNewDocument(() => {
    Object.defineProperties(navigator, {
      webdriver: { get: () => undefined },
      hardwareConcurrency: { get: () => 8 },
      deviceMemory: { get: () => 8 },
      platform: { get: () => "Win32" },
      languages: { get: () => ["en-US", "en"] },
      permissions: {
        get: () => ({
          query: async () => ({ state: "prompt" }),
        }),
      },
    });
    if (typeof (window as any).chrome === "undefined") {
      (window as any).chrome = {
        app: {
          InstallState: { DISABLED: "disabled", INSTALLED: "installed", NOT_INSTALLED: "not_installed" },
          RunningState: { CANNOT_RUN: "cannot_run", READY_TO_RUN: "ready_to_run", RUNNING: "running" },
          getDetails: () => { }, getIsInstalled: () => { }, installState: () => { }, isInstalled: false, runningState: () => { },
        },
        runtime: {
          OnInstalledReason: { CHROME_UPDATE: "chrome_update", INSTALL: "install", SHARED_MODULE_UPDATE: "shared_module_update", UPDATE: "update" },
          PlatformArch: { ARM: "arm", ARM64: "arm64", MIPS: "mips", MIPS64: "mips64", X86_32: "x86-32", X86_64: "x86-64" },
          PlatformNaclArch: { ARM: "arm", MIPS: "mips", PNACL: "pnacl", X86_32: "x86-32", X86_64: "x86-64" },
          PlatformOs: { ANDROID: "android", CROS: "cros", LINUX: "linux", MAC: "mac", OPENBSD: "openbsd", WIN: "win" },
          RequestUpdateCheckStatus: { NO_UPDATE: "no_update", THROTTLED: "throttled", UPDATE_AVAILABLE: "update_available" },
          connect: () => ({ postMessage: () => { }, onMessage: { addListener: () => { }, removeListener: () => { } }, disconnect: () => { } }),
        },
      };
    }
  });
}

export async function waitForSearchInput(ctx: PuppeteerContext, timeout = CONFIG.SELECTOR_TIMEOUT): Promise<string | null> {
  const { page, setSearchInputSelector } = ctx;
  if (!page) return null;

  const primarySelector = '[role="textbox"]';
  try {
    const element = await page.waitForSelector(primarySelector, { timeout: 2000, visible: true });
    if (element) {
      const isInteractive = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el && !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true";
      }, primarySelector);
      if (isInteractive) {
        setSearchInputSelector(primarySelector);
        return primarySelector;
      }
    }
  } catch { /* ignore */ }

  const fallbackSelectors = getSearchInputSelectors().filter((s) => s !== primarySelector);
  for (const selector of fallbackSelectors) {
    try {
      const element = await page.waitForSelector(selector, { timeout: 1500, visible: true });
      if (element) {
        const isInteractive = await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          return el && !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true";
        }, selector);
        if (isInteractive) {
          setSearchInputSelector(selector);
          return selector;
        }
      }
    } catch { /* ignore */ }
  }
  return null;
}

export async function checkForCaptcha(ctx: PuppeteerContext): Promise<boolean> {
  const { page } = ctx;
  if (!page) return false;
  const captchaIndicators = getCaptchaSelectors();
  return await page.evaluate((selectors) => {
    return selectors.some((selector) => !!document.querySelector(selector));
  }, captchaIndicators);
}

export async function recoveryProcedure(ctx: PuppeteerContext, error?: Error): Promise<void> {
  const recoveryContext: RecoveryContext = {
    hasValidPage: !!(ctx.page && !ctx.page.isClosed() && !ctx.page.mainFrame()?.isDetached()),
    hasBrowser: !!ctx.browser,
    isBrowserConnected: !!ctx.browser?.isConnected(),
    operationCount: ctx.operationCount,
  };

  const recoveryLevel = determineRecoveryLevel(error, recoveryContext);
  ctx.incrementOperationCount();

  try {
    switch (recoveryLevel) {
      case 1:
        if (ctx.page && !ctx.page.isClosed()) {
          await ctx.page.reload({ timeout: CONFIG.TIMEOUT_PROFILES.navigation });
        }
        break;
      case 3:
      default:
        if (ctx.page) try { await ctx.page.close(); } catch { /* ignore */ }
        if (ctx.browser) try { await ctx.browser.close(); } catch { /* ignore */ }
        ctx.setPage(null);
        ctx.setBrowser(null);
        ctx.setIsInitializing(false);
        await new Promise((r) => setTimeout(r, CONFIG.RECOVERY_WAIT_TIME));
        await initializeBrowser(ctx);
        break;
    }
  } catch (recoveryError) {
    if (recoveryLevel < 3) await recoveryProcedure(ctx, new Error("Fallback recovery"));
    else throw recoveryError;
  }
}

export async function retryOperation<T>(ctx: PuppeteerContext, operation: () => Promise<T>, maxRetries = CONFIG.MAX_RETRIES): Promise<T> {
  let lastError: Error | null = null;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (i === maxRetries - 1) break;
      await recoveryProcedure(ctx, lastError);
    }
  }
  throw lastError || new Error("Operation failed");
}

export function resetIdleTimeout(ctx: PuppeteerContext) {
  if (ctx.idleTimeout) clearTimeout(ctx.idleTimeout);
  const timeout = setTimeout(async () => {
    try {
      if (ctx.page) await ctx.page.close();
      if (ctx.browser) await ctx.browser.close();
      ctx.setPage(null);
      ctx.setBrowser(null);
      ctx.setIsInitializing(false);
    } catch { /* ignore */ }
  }, ctx.IDLE_TIMEOUT_MS ?? 5 * 60 * 1000);
  ctx.setIdleTimeout(timeout);
}

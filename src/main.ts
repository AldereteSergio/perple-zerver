import { existsSync, mkdirSync } from "node:fs";
import { CONFIG } from "./server/config.js";
import { initializeBrowser } from "./utils/puppeteer.js";
import type { PuppeteerContext } from "./types/index.js";
import { PerplexityServer } from "./server/PerplexityServer.js";

const PERPLEXITY_URL = "https://www.perplexity.ai";

async function runLogin() {
    console.log("🔐 Perplexity Pro Account Login\n");

    const profileDir = CONFIG.BROWSER_DATA_DIR;
    if (!existsSync(profileDir)) {
        mkdirSync(profileDir, { recursive: true });
        console.log(`📁 Created profile directory: ${profileDir}`);
    }

    console.log(`📂 Using profile directory: ${profileDir}\n`);
    console.log("🌐 Opening browser (Headless: FALSE)...\n");

    const mockCtx: PuppeteerContext = {
        browser: null,
        page: null,
        isInitializing: false,
        searchInputSelector: '[role="textbox"]',
        lastSearchTime: 0,
        idleTimeout: null,
        operationCount: 0,
        log: () => {},
        setBrowser: (b) => { mockCtx.browser = b as any; },
        setPage: (p) => { mockCtx.page = p as any; },
        setIsInitializing: (i) => { mockCtx.isInitializing = i; },
        setSearchInputSelector: (s) => { mockCtx.searchInputSelector = s; },
        setIdleTimeout: (t) => { mockCtx.idleTimeout = t; },
        incrementOperationCount: () => ++mockCtx.operationCount,
        determineRecoveryLevel: () => 1,
        IDLE_TIMEOUT_MS: 0
    };

    await initializeBrowser(mockCtx, false); // headless = false

    if (!mockCtx.page) throw new Error("Failed to open browser page");

    console.log("📍 Navigating to Perplexity...");
    try {
        await (mockCtx.page as any).goto(PERPLEXITY_URL, {
            waitUntil: "domcontentloaded",
            timeout: CONFIG.PAGE_TIMEOUT,
        });
        console.log("✅ Navigation successful!\n");
    } catch (err) {
        console.log("⚠️  Navigation issue, but browser is open. Proceed manually.\n");
    }

    console.log("═══════════════════════════════════════════════════════════════");
    console.log("║   1. Log into your Perplexity Pro account                   ║");
    console.log("║   2. Once logged in, CLOSE the browser window               ║");
    console.log("║   3. Your session will be saved in your HOME folder         ║");
    console.log("═══════════════════════════════════════════════════════════════\n");

    await new Promise<void>((resolve) => {
        (mockCtx.browser as any)?.on("disconnected", () => resolve());
    });

    console.log("\n✅ Login session saved successfully!");
}

async function main() {
    const args = process.argv.slice(2);
    if (args.includes("login")) {
        await runLogin();
        process.exit(0);
    }

    const server = new PerplexityServer();
    await server.run();
}

main().catch((error) => {
    console.error("❌ Error:", error.message);
    process.exit(1);
});

import { Readability } from "@mozilla/readability";
import axios from "axios";
import { JSDOM } from "jsdom";
import type { Page } from "puppeteer-core";
import { CONFIG } from "../server/config.js";
import type { PageContentResult, PuppeteerContext } from "../types/index.js";
import { fetchSimpleContent } from "./fetch.js";
import { initializeBrowser } from "./puppeteer.js";

function detectAndRewriteGitHubUrl(url: string): { extractionUrl: string; isGitHubRepo: boolean } {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "github.com") {
      const parts = parsed.pathname.split("/").filter(p => p.length > 0);
      if (parts.length === 2) return { extractionUrl: `https://gitingest.com${parsed.pathname}`, isGitHubRepo: true };
    }
  } catch { /* ignore */ }
  return { extractionUrl: url, isGitHubRepo: false };
}

async function performContentTypeCheck(url: string, isGitHub: boolean): Promise<string | null> {
  if (isGitHub) return null;
  try {
    const res = await axios.head(url, { timeout: 5000, headers: { "User-Agent": CONFIG.USER_AGENT } });
    const ct = res.headers["content-type"];
    if (ct && !ct.includes("html") && !ct.includes("text/plain")) return `Unsupported type: ${ct}`;
  } catch { /* ignore */ }
  return null;
}

export async function fetchSinglePageContent(url: string, ctx: PuppeteerContext): Promise<PageContentResult> {
  const { extractionUrl, isGitHubRepo } = detectAndRewriteGitHubUrl(url);
  const ctError = await performContentTypeCheck(extractionUrl, isGitHubRepo);
  if (ctError) return { url, error: ctError };

  try {
    if (!ctx.page || ctx.page.isClosed()) await initializeBrowser(ctx);
    const page = ctx.page as any;
    await page.goto(extractionUrl, { waitUntil: "domcontentloaded", timeout: CONFIG.PAGE_TIMEOUT });
    if (isGitHubRepo) await page.waitForSelector(".result-text", { timeout: 30000 }).catch(() => {});

    const html = await page.content();
    const dom = new JSDOM(html, { url: extractionUrl });
    
    if (isGitHubRepo) {
      const content = await page.evaluate(() => (document.querySelector(".result-text") as any)?.value);
      if (content) return { url, title: await page.title(), textContent: content };
    }

    const article = new Readability(dom.window.document).parse();
    if (article?.textContent) return { url, title: article.title, textContent: article.textContent.trim() };

    const fallback = await page.evaluate(() => {
      const el = document.querySelector('article, main, .content, body');
      return el ? (el as HTMLElement).innerText.trim() : null;
    });
    return fallback ? { url, title: await page.title(), textContent: fallback } : { url, error: "No content" };
  } catch (e) { return { url, error: String(e) }; }
}

export async function extractSameDomainLinks(page: Page, baseUrl: string): Promise<{ url: string; text: string }[]> {
  try {
    const base = new URL(baseUrl).hostname;
    const links = await page.evaluate(() => Array.from(document.querySelectorAll("a[href]")).map(a => ({ url: a.getAttribute("href"), text: (a as HTMLElement).innerText.trim() })));
    return links.map(l => {
      try {
        const abs = new URL(l.url!, baseUrl).href;
        return new URL(abs).hostname === base ? { url: abs, text: l.text } : null;
      } catch { return null; }
    }).filter((l): l is { url: string; text: string } => !!l).slice(0, 10);
  } catch { return []; }
}

export async function recursiveFetch(url: string, max: number, curr: number, visited: Set<string>, results: PageContentResult[], signal: { timedOut: boolean }, ctx: PuppeteerContext): Promise<void> {
  if (curr > max || visited.has(url) || signal.timedOut) return;
  visited.add(url);
  try {
    const res = curr === 1 ? await fetchSinglePageContent(url, ctx) : await fetchSimpleContent(url, ctx);
    const finalRes: PageContentResult = {
      url: url,
      title: res.title,
      textContent: res.textContent,
      error: res.error
    };
    results.push(finalRes);
    if (curr < max && !finalRes.error && ctx.page) {
      const links = await extractSameDomainLinks(ctx.page as any, url);
      await Promise.all(links.slice(0, 3).map(l => recursiveFetch(l.url, max, curr + 1, visited, results, signal, ctx)));
    }
  } catch { /* ignore */ }
}

/**
 * SearchEngine - Handles search operations and answer extraction
 * Focused, testable module for Perplexity search functionality
 */
import type { Page } from "puppeteer-core";
import type { IBrowserManager, ISearchEngine } from "../../types/index.js";
import { logError, logInfo, logWarn } from "../../utils/logging.js";
import { retryOperation } from "../../utils/puppeteer.js";
import { CONFIG } from "../config.js";

export class SearchEngine implements ISearchEngine {
  constructor(private readonly browserManager: IBrowserManager) {}

  async performSearch(query: string, model?: string, attachments?: string[]): Promise<string> {
    const operationTimeout = setTimeout(() => {
      logError("Global operation timeout reached, initiating recovery...");
      this.browserManager.performRecovery().catch((err: unknown) => {
        logError("Recovery after timeout failed:", { error: err instanceof Error ? err.message : String(err) });
      });
    }, CONFIG.PAGE_TIMEOUT - CONFIG.MCP_TIMEOUT_BUFFER);

    try {
      if (!this.browserManager.isReady()) await this.browserManager.initialize();
      this.browserManager.resetIdleTimeout();
      const ctx = this.browserManager.getPuppeteerContext();
      
      return await retryOperation(ctx, async () => {
        await this.browserManager.navigateToPerplexity();
        const page = this.browserManager.getPage();
        if (!page || (page as any).mainFrame().isDetached()) throw new Error("Main frame is detached");

        const selector = await this.browserManager.waitForSearchInput();
        if (!selector) throw new Error("Search input not found");

        if (model) await this.selectModel(page as any, model);
        if (attachments && attachments.length > 0) await this.uploadAttachments(page as any, attachments);

        await this.executeSearch(page as any, selector, query);
        return await this.waitForCompleteAnswer(page as any);
      }, CONFIG.MAX_RETRIES);
    } catch (error) {
      logError("Search operation failed:", { error: error instanceof Error ? error.message : String(error) });
      return this.generateErrorResponse(error);
    } finally {
      clearTimeout(operationTimeout);
    }
  }

  private async executeSearch(page: Page, selector: string, query: string): Promise<void> {
    try {
      await page.evaluate((sel) => {
        const input = document.querySelector(sel) as HTMLTextAreaElement;
        if (input) input.value = "";
      }, selector);
      await page.click(selector, { clickCount: 3 });
      await page.keyboard.press("Backspace");
    } catch { /* ignore */ }

    const typeDelay = Math.floor(Math.random() * 20) + 20;
    await page.type(selector, query, { delay: typeDelay });
    await page.keyboard.press("Enter");
  }

  private async waitForCompleteAnswer(page: Page): Promise<string> {
    const proseSelectors = [".prose", '[class*="prose"]', '[class*="answer"]', '[class*="result"]'];
    let selectorFound = false;
    for (const proseSelector of proseSelectors) {
      try {
        await page.waitForSelector(proseSelector, { timeout: CONFIG.SELECTOR_TIMEOUT, visible: true });
        selectorFound = true;
        break;
      } catch { /* ignore */ }
    }

    if (!selectorFound) return await this.extractFallbackAnswer(page);
    return await this.extractCompleteAnswer(page);
  }

  private async extractCompleteAnswer(page: Page): Promise<string> {
    const timeoutPromise = new Promise<string>((_, reject) => {
      setTimeout(() => reject(new Error('Waiting for complete answer timed out')), CONFIG.ANSWER_WAIT_TIMEOUT);
    });

    const answerPromise = page.evaluate(async () => {
      const isSafeUrl = (href: string): boolean => {
        if (!href) return false;
        const blocked = ["javascript:", "data:", "vbscript:", "#"];
        return !blocked.some(b => href.startsWith(b));
      };

      const getAnswer = () => {
        const elements = Array.from(document.querySelectorAll(".prose"));
        const answerText = elements.map((el) => (el as HTMLElement).innerText.trim()).join("\n\n");
        const links = Array.from(document.querySelectorAll(".prose a[href]"));
        const urls = links.map(link => (link as HTMLAnchorElement).href).filter(isSafeUrl).map(href => href.trim());
        return urls.length > 0 ? `${answerText}\n\nURLs:\n${urls.map(url => `- ${url}`).join('\n')}` : answerText;
      };

      let lastAnswer = '';
      let lastLength = 0;
      let stabilityCounter = 0;
      for (let i = 0; i < 60; i++) {
        await new Promise((resolve) => setTimeout(resolve, 600));
        const currentAnswer = getAnswer();
        const currentLength = currentAnswer.length;
        if (currentLength > 0) {
          if (currentLength > lastLength) {
            lastLength = currentLength;
            stabilityCounter = 0;
          } else if (currentAnswer === lastAnswer) {
            stabilityCounter++;
            if ((currentLength > 1000 && stabilityCounter >= 3) || (currentLength > 500 && stabilityCounter >= 4) || stabilityCounter >= 5) break;
          }
          lastAnswer = currentAnswer;
        }
      }
      return lastAnswer || 'No content found';
    });

    return await Promise.race([answerPromise, timeoutPromise]);
  }

  private async extractFallbackAnswer(page: Page): Promise<string> {
    return await page.evaluate(() => {
      const selectors = ['main', 'article', '.content', '.answer', 'p'];
      for (const selector of selectors) {
        const elements = Array.from(document.querySelectorAll(selector)).filter(el => (el as HTMLElement).innerText.trim().length > 100);
        if (elements.length > 0) return elements.map(el => (el as HTMLElement).innerText.trim()).join('\n\n');
      }
      return document.body.innerText.substring(0, 2000);
    });
  }

  private generateErrorResponse(error: unknown): string {
    const msg = error instanceof Error ? error.message : String(error);
    return `Error: ${msg}. Please try again.`;
  }

  async listAvailableModels(): Promise<string[]> {
    try {
      if (!this.browserManager.isReady()) await this.browserManager.initialize();
      await this.browserManager.navigateToPerplexity();
      const page = this.browserManager.getPage();
      if (!page) throw new Error("Page not initialized");

      const inputSelector = '[role="textbox"]';
      await page.waitForSelector(inputSelector);
      
      // Clear and type a space to trigger the model button if hidden
      await page.click(inputSelector);
      await page.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLTextAreaElement;
        if (el) el.value = '';
      }, inputSelector);
      await page.keyboard.type(" ");
      await new Promise((r) => setTimeout(r, 500));

      // Try multiple selectors for the model button
      const modelButtonSelectors = [
        'button[aria-label="Model"]',
        'button[aria-label="Modelo"]',
        'button:has(span:text("Model"))',
        'button:has(span:text("Modelo"))'
      ];
      
      let foundButton = false;
      for (const sel of modelButtonSelectors) {
        try {
          await page.waitForSelector(sel, { timeout: 2000 });
          await page.click(sel);
          foundButton = true;
          break;
        } catch { continue; }
      }

      if (!foundButton) {
        // Fallback: try to find any button that looks like a model selector
        const clicked = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const modelBtn = buttons.find(b => 
            b.innerText.toLowerCase().includes('model') || 
            b.innerText.toLowerCase().includes('modelo') ||
            b.getAttribute('aria-label')?.toLowerCase().includes('model')
          );
          if (modelBtn) {
            (modelBtn as HTMLElement).click();
            return true;
          }
          return false;
        });
        if (!clicked) return [];
      }

      await new Promise((r) => setTimeout(r, 1000));

      const models = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('[role="menuitem"], [role="option"], button, span'));
        const names = items
          .map((el) => (el as HTMLElement).innerText?.trim() || "")
          .filter((t) => 
            t.length > 0 && 
            (t.includes("Claude") || t.includes("GPT") || t.includes("Sonar") || 
             t.includes("DeepSeek") || t.includes("o1") || t.includes("Pro") ||
             t.includes("Gemini") || t.includes("Llama"))
          );
        return [...new Set(names)];
      });

      // Cleanup: click body to close menu and clear input
      await page.click("body");
      await page.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLTextAreaElement;
        if (el) el.value = '';
      }, inputSelector);

      return models;
    } catch (error) { 
      logError("Error listing models:", { error: error instanceof Error ? error.message : String(error) });
      return []; 
    }
  }

  async performDeepResearch(query: string, attachments?: string[]): Promise<string> {
    try {
      if (!this.browserManager.isReady()) await this.browserManager.initialize();
      const ctx = this.browserManager.getPuppeteerContext();
      return await retryOperation(ctx, async () => {
        await this.browserManager.navigateToPerplexity();
        const page = this.browserManager.getPage();
        if (!page) throw new Error("Page not initialized");

        await page.waitForSelector('button[aria-label="Add files or tools"]');
        await page.click('button[aria-label="Add files or tools"]');
        await new Promise((r) => setTimeout(r, 1000));

        await page.evaluate(() => {
          const items = Array.from(document.querySelectorAll('[role="menuitem"], button'));
          const target = items.find((el) => {
            const text = (el as HTMLElement).innerText.toLowerCase();
            return text.includes("deep research") || text.includes("investigación profunda");
          });
          if (target) (target as HTMLElement).click();
        });

        if (attachments && attachments.length > 0) await this.uploadAttachments(page as any, attachments);
        const selector = await this.browserManager.waitForSearchInput();
        if (!selector) throw new Error("Search input not found");
        await this.executeSearch(page as any, selector, query);
        return await this.waitForCompleteAnswer(page as any);
      });
    } catch (error) { return this.generateErrorResponse(error); }
  }

  private async uploadAttachments(page: Page, filePaths: string[]): Promise<void> {
    try {
      const input = (await page.$('input[type="file"]')) as any;
      if (input) {
        await input.uploadFile(...filePaths);
        await new Promise((r) => setTimeout(r, 3000));
      }
    } catch { /* ignore */ }
  }

  private async selectModel(page: Page, modelName: string): Promise<void> {
    try {
      await page.waitForSelector('button[aria-label="Model"]');
      await page.click('button[aria-label="Model"]');
      await new Promise((r) => setTimeout(r, 1000));
      await page.evaluate((targetModel) => {
        const items = Array.from(document.querySelectorAll('[role="menuitem"], [role="option"], button, span'));
        const target = items.find((el) => (el as HTMLElement).innerText.toLowerCase().includes(targetModel.toLowerCase()));
        if (target) (target as HTMLElement).click();
      }, modelName);
      await new Promise((r) => setTimeout(r, 1000));
    } catch { try { await page.click("body"); } catch { /* ignore */ } }
  }
}

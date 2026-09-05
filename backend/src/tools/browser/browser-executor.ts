import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

export interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

export interface BrowserExecutionResult {
  success: boolean;
  url: string;
  title: string;
  screenshotPath?: string;
  error?: string;
}

export async function createBrowserSession(): Promise<BrowserSession> {
  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext();

  const page = await context.newPage();

  return {
    browser,
    context,
    page,
  };
}

export async function closeBrowserSession(
  session: BrowserSession
): Promise<void> {
  await session.context.close();
  await session.browser.close();
}

export async function openAndCapture(
  url: string,
  screenshotPath: string
): Promise<BrowserExecutionResult> {
  const session = await createBrowserSession();

  try {
    await session.page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    const title = await session.page.title();

    await session.page.screenshot({
      path: screenshotPath,
      fullPage: true,
    });

    return {
      success: true,
      url: session.page.url(),
      title,
      screenshotPath,
    };
  } catch (error) {
    return {
      success: false,
      url,
      title: "",
      error: error instanceof Error ? error.message : "Unknown browser error",
    };
  } finally {
    await closeBrowserSession(session);
  }
}
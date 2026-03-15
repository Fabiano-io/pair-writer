import fs from "node:fs";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

async function main() {
  const [htmlPath, outputPath, browserPath] = process.argv.slice(2);

  if (!htmlPath || !outputPath) {
    throw new Error("Usage: node render-html-to-pdf.mjs <htmlPath> <outputPath> [browserPath]");
  }

  if (!fs.existsSync(htmlPath)) {
    throw new Error(`HTML source file was not found: ${htmlPath}`);
  }

  const browser = await chromium.launch({
    executablePath: browserPath || undefined,
    headless: true,
    args: [
      "--disable-gpu",
      "--allow-file-access-from-files",
      "--disable-dev-shm-usage",
    ],
  });

  try {
    const page = await browser.newPage({
      viewport: { width: 1400, height: 2000 },
      deviceScaleFactor: 1,
    });

    await page.goto(pathToFileURL(htmlPath).href, {
      waitUntil: "load",
      timeout: 30000,
    });

    await page.emulateMedia({ media: "screen" });

    await page.waitForFunction(() => document.readyState === "complete", {
      timeout: 15000,
    });

    await page.evaluate(async () => {
      if ("fonts" in document) {
        await document.fonts.ready;
      }

      const images = Array.from(document.images);
      await Promise.all(
        images.map(
          (image) =>
            new Promise((resolve) => {
              if (image.complete) {
                resolve(true);
                return;
              }

              image.addEventListener("load", () => resolve(true), { once: true });
              image.addEventListener("error", () => resolve(true), { once: true });
            })
        )
      );
    });

    await page.pdf({
      path: outputPath,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
    });
  } finally {
    await browser.close();
  }

  if (!fs.existsSync(outputPath)) {
    throw new Error(`PDF output file was not generated: ${outputPath}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});

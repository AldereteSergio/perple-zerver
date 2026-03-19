import puppeteer from "puppeteer";
import { CONFIG } from "./build/server/config.js";
import { generateBrowserArgs } from "./build/utils/puppeteer-logic.js";

async function inspectModels() {
  console.log("🔍 Iniciando inspección de modelos en Perplexity...");
  
  const browser = await puppeteer.launch({
    headless: false,
    args: generateBrowserArgs(CONFIG.USER_AGENT),
    userDataDir: CONFIG.BROWSER_DATA_DIR
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  
  try {
    console.log("📍 Navegando a Perplexity...");
    await page.goto("https://www.perplexity.ai", { waitUntil: "networkidle2" });

    console.log("⏳ Esperando al botón de 'Modelo'...");
    const modelButtonSelector = 'button[aria-label="Modelo"]';
    
    // 1. Intentar enfocar el input primero para "despertar" la UI
    console.log("⌨️ Enfocando el input de búsqueda...");
    const inputSelector = '[role="textbox"]';
    try {
      await page.waitForSelector(inputSelector, { timeout: 5000 });
      await page.click(inputSelector);
      await page.keyboard.type(" "); // Un espacio para activar botones
      console.log("✅ Input enfocado y activado.");
    } catch (e) {
      console.log("⚠️ No se pudo enfocar el input principal.");
    }

    // 2. Extraer TODOS los botones y sus atributos para ver qué hay
    console.log("🔍 Escaneando todos los botones de la página...");
    const allButtons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).map(b => ({
        text: b.innerText.trim(),
        ariaLabel: b.getAttribute('aria-label'),
        id: b.id,
        className: b.className,
        isVisible: b.offsetWidth > 0 && b.offsetHeight > 0
      }));
    });
    
    console.log(`📊 Se encontraron ${allButtons.length} botones.`);
    const interestingButtons = allButtons.filter(b => 
      (b.text && b.text.toLowerCase().includes("model")) || 
      (b.ariaLabel && b.ariaLabel.toLowerCase().includes("model")) ||
      (b.text && b.text.toLowerCase().includes("modelo")) || 
      (b.ariaLabel && b.ariaLabel.toLowerCase().includes("modelo"))
    );
    
    if (interestingButtons.length > 0) {
      console.log("🎯 Botones interesantes encontrados:");
      interestingButtons.forEach(b => console.log(`   - Texto: "${b.text}", Aria-Label: "${b.ariaLabel}", Visible: ${b.isVisible}`));
    } else {
      console.log("❌ No se encontraron botones con la palabra 'Modelo' o 'Model'.");
      console.log("📋 Primeros 10 botones encontrados para referencia:");
      allButtons.slice(0, 10).forEach(b => console.log(`   - [${b.text}] Aria: ${b.ariaLabel}`));
    }

    // 3. Intentar el click de nuevo con el selector que me pasaste
    try {
      const actualModelSelector = 'button[aria-label="Model"]';
      await page.waitForSelector(actualModelSelector, { timeout: 5000 });
      console.log("🖱️ Haciendo click en el botón de 'Model'...");
      await page.click(actualModelSelector);
      console.log("✅ Click realizado.");
      
      console.log("⏳ Esperando a que el menú de modelos se despliegue...");
      await new Promise(r => setTimeout(r, 2000));
      
      // Capturar todos los elementos que parecen ser opciones de modelo
      const modelOptions = await page.evaluate(() => {
        // Buscamos elementos dentro de popovers o menús que suelen aparecer al final del body
        // Perplexity usa Radix UI o similar, así que buscamos roles de menú o divs con texto específico
        const items = Array.from(document.querySelectorAll('[role="menuitem"], [role="option"], button, span'));
        
        return items
          .map(el => ({
            text: el.innerText.trim(),
            role: el.getAttribute('role'),
            tagName: el.tagName
          }))
          .filter(item => 
            item.text.length > 0 && 
            (item.text.includes("Claude") || 
             item.text.includes("GPT") || 
             item.text.includes("Sonar") || 
             item.text.includes("DeepSeek") ||
             item.text.includes("o1") ||
             item.text.includes("Pro"))
          );
      });

      if (modelOptions.length > 0) {
        console.log("📋 Lista de modelos detectados en el menú:");
        // Eliminar duplicados por texto
        const uniqueModels = [...new Map(modelOptions.map(m => [m.text, m])).values()];
        uniqueModels.forEach((m, i) => console.log(`   ${i + 1}. [${m.text}] (Tag: ${m.tagName}, Role: ${m.role})`));
      } else {
        console.log("⚠️ No se detectaron modelos específicos en el menú.");
        console.log("📸 Tomando captura del menú abierto para inspección visual...");
        await page.screenshot({ path: "debug_open_menu.png" });
      }
    } catch (e) {
      console.log("⚠️ El click en 'Model' falló o el menú no se abrió.");
    }

  } catch (error) {
    console.error("❌ Error durante la inspección:", error);
  } finally {
    console.log("\n👋 Mantendré el navegador abierto 15 segundos más para que lo veas...");
    await new Promise(r => setTimeout(r, 15000));
    await browser.close();
    console.log("🔒 Navegador cerrado.");
  }
}

inspectModels();

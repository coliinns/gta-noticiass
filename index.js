import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';
import chromium from 'chrome-aws-lambda';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
  console.log(`✅ Bot online: ${client.user.tag}`);
  checkNews();
  setInterval(checkNews, 6 * 60 * 60 * 1000); // a cada 6 horas
});

async function checkNews() {
  console.log("🔍 Buscando notícias via Puppeteer...");

  let browser;
  try {
    browser = await chromium.puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.goto("https://www.rockstargames.com/newswire", {
      waitUntil: "domcontentloaded",
    });

    const noticia = await page.evaluate(() => {
      const el = document.querySelector(".NewswireList-item");
      if (!el) return null;

      const titulo = el.querySelector(".NewswireList-title")?.textContent?.trim();
      const resumo = el.querySelector(".NewswireList-summary")?.textContent?.trim();
      const imagem = el.querySelector("img")?.src;
      const link = "https://www.rockstargames.com" + el.querySelector("a")?.getAttribute("href");

      if (!titulo.toLowerCase().includes("gta online")) return null;

      return { titulo, resumo, imagem, link };
    });

    if (!noticia) {
      console.log("⚠️ Nenhuma notícia de GTA Online encontrada.");
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(noticia.titulo)
      .setDescription(noticia.resumo)
      .setImage(noticia.imagem)
      .setURL(noticia.link)
      .setColor(0xff0000)
      .setFooter({ text: "Fonte: Rockstar Newswire" })
      .setTimestamp();

    const channel = await client.channels.fetch(process.env.CHANNEL_ID);
    await channel.send({ embeds: [embed] });

    console.log("📰 Notícia postada:", noticia.titulo);

  } catch (err) {
    console.error("🚨 Falha ao buscar ou enviar notícia:", err);
  } finally {
    if (browser) await browser.close();
  }
}

client.login(process.env.DISCORD_TOKEN);

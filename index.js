import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import chromium from 'chrome-aws-lambda';

dotenv.config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
  console.log(`✅ Bot online: ${client.user.tag}`);
  checkNews();
  setInterval(checkNews, 5 * 60 * 1000); // a cada 5 minutos
});

async function checkNews() {
  console.log('🔍 Iniciando Puppeteer...');

  let browser;
  try {
    browser = await chromium.puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.goto("https://www.rockstargames.com/newswire", { waitUntil: 'domcontentloaded' });

    const noticias = await page.evaluate(() => {
      const cards = document.querySelectorAll(".NewswireList-item");
      const resultados = [];

      for (const card of cards) {
        const titulo = card.querySelector(".NewswireList-title")?.textContent?.trim() || "";
        const resumo = card.querySelector(".NewswireList-summary")?.textContent?.trim() || "";
        const imagem = card.querySelector("img")?.src || "";
        const link = "https://www.rockstargames.com" + (card.querySelector("a")?.getAttribute("href") || "");

        if (titulo.toLowerCase().includes("gta online")) {
          resultados.push({ titulo, resumo, imagem, link });
          break; // só 1 notícia
        }
      }

      return resultados;
    });

    if (noticias.length === 0) {
      console.log("⚠️ Nenhuma notícia GTA Online encontrada.");
      return;
    }

    const noticia = noticias[0];

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

import 'dotenv/config';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';
import chromium from 'chrome-aws-lambda';
import puppeteer from 'puppeteer-core';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
let lastPostedLink = "";

client.once('ready', () => {
  console.log(`✅ Bot online: ${client.user.tag}`);
  checkNews();
  setInterval(checkNews, 10 * 60 * 1000); // checa a cada 10 minutos
});

async function checkNews() {
  try {
    console.log("🔍 Acessando site com Puppeteer...");
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });
    const page = await browser.newPage();
    await page.goto('https://www.rockstargames.com/newswire', { waitUntil: 'networkidle0' });
    const articles = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.NewswireList-item')).map(el => ({
        title: el.querySelector('.NewswireList-title')?.innerText.trim() || '',
        summary: el.querySelector('.NewswireList-summary')?.innerText.trim() || '',
        link: 'https://www.rockstargames.com' + (el.querySelector('a')?.getAttribute('href') || ''),
        img: el.querySelector('img')?.src || null
      }));
    });
    await browser.close();

    if (!articles.length) {
      console.log("⚠️ Sem notícias encontradas.");
      return;
    }

    const latest = articles[0];
    if (!latest.title.toLowerCase().includes("gta online")) {
      console.log("🔁 A notícia não é do GTA Online.");
      return;
    }

    if (latest.link === lastPostedLink) {
      console.log("🔁 Sem notícia nova.");
      return;
    }

    lastPostedLink = latest.link;
    const translated = await translateText(latest.summary, 'pt');
    const embed = new EmbedBuilder()
      .setTitle(latest.title)
      .setDescription(translated)
      .setURL(latest.link)
      .setImage(latest.img)
      .setFooter({ text: 'Fonte: Rockstar Newswire' })
      .setColor(0xff0000)
      .setTimestamp();
    const channel = await client.channels.fetch(process.env.CHANNEL_ID);
    await channel.send({ embeds: [embed] });
    console.log("📢 Notícia enviada:", latest.title);
  } catch (err) {
    console.error("🚨 Falha ao buscar ou enviar notícia:", err);
  }
}

async function translateText(text, targetLang = 'pt') {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    const data = await res.json();
    return data[0].map(x => x[0]).join('') || text;
  } catch {
    return text;
  }
}

client.login(process.env.DISCORD_TOKEN);

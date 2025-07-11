const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const puppeteer = require('puppeteer-core');
const chromium = require('chrome-aws-lambda');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
let lastPostedLink = "";

client.once('ready', () => {
  console.log(`✅ Bot online: ${client.user.tag}`);
  checkNews();
  setInterval(checkNews, 10 * 60 * 1000); // a cada 10 min
});

async function checkNews() {
  try {
    console.log("🔍 Iniciando Puppeteer...");
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.goto('https://www.rockstargames.com/newswire', { waitUntil: 'networkidle0' });

    // Pega os dados direto da página já renderizada
    const articles = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.NewswireList-item'));
      return items.map(el => {
        return {
          title: el.querySelector('.NewswireList-title')?.innerText.trim() || '',
          summary: el.querySelector('.NewswireList-summary')?.innerText.trim() || '',
          link: 'https://www.rockstargames.com' + (el.querySelector('a')?.getAttribute('href') || ''),
          img: el.querySelector('img')?.src || null,
        };
      });
    });

    await browser.close();

    if (!articles.length) {
      console.log("⚠️ Nenhuma notícia encontrada.");
      return;
    }

    // Pega a notícia mais recente
    const latest = articles[0];
    if (latest.link === lastPostedLink) {
      console.log("🔁 Nenhuma notícia nova.");
      return;
    }

    lastPostedLink = latest.link;

    // Traduz resumo
    const translated = await translateText(latest.summary, 'pt');

    // Monta embed
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

    console.log("✅ Notícia enviada:", latest.title);

  } catch (err) {
    console.error("🚨 Erro ao buscar/enviar notícia:", err);
  }
}

async function translateText(text, targetLang = "pt") {
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

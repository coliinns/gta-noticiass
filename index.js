import 'dotenv/config';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';
import { load } from 'cheerio';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

let lastPostedLink = "";

client.once('ready', () => {
  console.log(`✅ Bot online: ${client.user.tag}`);
  checkNews();
  setInterval(checkNews, 5 * 60 * 1000); // checa a cada 5 minutos
});

async function checkNews() {
  try {
    console.log("🔍 Buscando notícias via fetch + cheerio...");

    const res = await fetch("https://www.rockstargames.com/newswire");
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

    const html = await res.text();
    const $ = load(html);

    const newsItems = $(".NewswireList-item");
    console.log(`🧾 Total de notícias encontradas: ${newsItems.length}`);

    for (let i = 0; i < newsItems.length; i++) {
      const el = newsItems.eq(i);

      const title = el.find(".NewswireList-title").text().trim();
      const linkPartial = el.find("a").attr("href");
      if (!linkPartial) continue;
      const link = "https://www.rockstargames.com" + linkPartial;

      if (!title.toLowerCase().includes("gta online")) continue; // só GTA Online

      if (link === lastPostedLink) break; // já postamos

      lastPostedLink = link;

      const img = el.find("img").attr("src") || null;
      const summary = el.find(".NewswireList-summary").text().trim();

      const translated = await translateText(summary, "pt");

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(translated)
        .setURL(link)
        .setImage(img)
        .setFooter({ text: "Fonte: Rockstar Newswire" })
        .setColor(0xff0000)
        .setTimestamp();

      const channel = await client.channels.fetch(process.env.CHANNEL_ID);
      await channel.send({ embeds: [embed] });

      console.log("📰 Notícia postada:", title);
      break; // só posta a notícia mais recente por execução
    }
  } catch (err) {
    console.error("🚨 Erro ao buscar ou enviar notícia:", err);
  }
}

async function translateText(text, targetLang = "pt") {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    const data = await res.json();
    return data[0].map(x => x[0]).join("") || text;
  } catch {
    return text;
  }
}

client.login(process.env.DISCORD_TOKEN);

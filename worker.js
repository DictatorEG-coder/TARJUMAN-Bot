const TELEGRAM_API = "https://api.telegram.org";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/") {
      return json({ ok: true, service: "TARJUMAN BOT", status: "running" });
    }
    if (request.method !== "POST" || url.pathname !== "/telegram") {
      return new Response("Not found", { status: 404 });
    }
    if (!env.BOT_TOKEN) return json({ ok: false, error: "BOT_TOKEN is not configured" }, 500);
    if (env.WEBHOOK_SECRET &&
        request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    let update;
    try { update = await request.json(); }
    catch { return json({ ok: false, error: "Invalid JSON" }, 400); }

    const message = update.message;
    if (!message || message.from?.is_bot) return json({ ok: true });
    try {
      await handleMessage(message, env);
    } catch (error) {
      console.error("TARJUMAN error:", error?.stack || error);
      const chatId = message.chat?.id;
      if (chatId) {
        const replyId = message.reply_to_message?.message_id || message.message_id;
        let userMessage = "تعذرت معالجة طلبك الآن. حاول مرة أخرى بعد قليل.";
        if (String(error?.message).includes("OCR_SPACE_API_KEY")) {
          userMessage = "ترجمة الصور لم تُفعّل بعد. يلزم إضافة مفتاح OCR_SPACE_API_KEY في إعدادات Cloudflare.";
        } else if (/quota|limit|403|429/i.test(String(error?.message))) {
          userMessage = "وصلنا إلى حد الاستخدام المجاني لخدمة الترجمة أو قراءة الصور. حاول لاحقًا.";
        }
        await sendMessage(env, chatId, userMessage, {
          reply_to_message_id: replyId
        }).catch(() => {});
      }
    }
    return json({ ok: true });
  }
};

async function handleMessage(message, env) {
  const commandText = (message.text || message.caption || "").trim();
  const parsed = parseCommand(commandText);
  if (!parsed) return;

  const target = message.reply_to_message || message;
  const chatId = message.chat.id;
  const replyId = target.message_id || message.message_id;

  if (target.photo?.length) {
    await sendChatAction(env, chatId, "typing");
    const extracted = await extractImageText(target, env);
    if (!extracted) {
      await sendMessage(env, chatId, "لم أتمكن من استخراج نص واضح من الصورة. جرّب صورة أوضح وبجودة أعلى.", {
        reply_to_message_id: replyId
      });
      return;
    }
    const result = await translateText(extracted, parsed.target, env);
    await sendLongMessage(env, chatId, result, replyId);
    return;
  }

  let sourceText = target.text || target.caption || "";
  if (target === message) sourceText = removeCommandPrefix(commandText);
  if (!sourceText.trim()) {
    await sendMessage(env, chatId, "أرسل كلمة «ترجم» ردًا على رسالة أو صورة، أو اكتب النص بعد الأمر مباشرة.", {
      reply_to_message_id: message.message_id
    });
    return;
  }

  await sendChatAction(env, chatId, "typing");
  const result = await translateText(sourceText.trim(), parsed.target, env);
  await sendLongMessage(env, chatId, result, replyId);
}

function parseCommand(text) {
  const normalized = text.trim().replace(/^\/translate(?:@\w+)?/i, "ترجم").trim();
  if (!/^ترجم(?:\s|$)/u.test(normalized)) return null;
  const rest = normalized.replace(/^ترجم\s*/u, "").trim();
  if (!rest) return { target: "auto" };

  const destination = rest.replace(/^(?:إلى|الى|لل|لـ|ل)\s*/u, "").trim().toLowerCase();
  const languages = {
    "العربية":"ar", "عربي":"ar", "arabic":"ar", "ar":"ar",
    "الإنجليزية":"en", "انجليزية":"en", "إنجليزي":"en", "انجليزي":"en", "english":"en", "en":"en",
    "الفرنسية":"fr", "فرنسي":"fr", "french":"fr", "fr":"fr",
    "الألمانية":"de", "الالمانية":"de", "ألماني":"de", "german":"de", "de":"de",
    "الإسبانية":"es", "الاسبانية":"es", "إسباني":"es", "spanish":"es", "es":"es",
    "التركية":"tr", "تركي":"tr", "turkish":"tr", "tr":"tr",
    "الروسية":"ru", "روسي":"ru", "russian":"ru", "ru":"ru",
    "الإيطالية":"it", "الايطالية":"it", "إيطالي":"it", "italian":"it", "it":"it",
    "اليابانية":"ja", "ياباني":"ja", "japanese":"ja", "ja":"ja",
    "الصينية":"zh-CN", "صيني":"zh-CN", "chinese":"zh-CN",
    "البرتغالية":"pt", "portuguese":"pt", "pt":"pt",
    "الهندية":"hi", "هندي":"hi", "hindi":"hi", "hi":"hi"
  };
  if (languages[destination]) return { target: languages[destination] };
  if (/^[a-z]{2}(?:-[A-Z]{2})?$/.test(destination)) return { target: destination };
  return { target: "auto" };
}

function removeCommandPrefix(text) {
  return text.replace(/^\/translate(?:@\w+)?\s*/i, "")
    .replace(/^ترجم(?:\s+(?:إلى|الى|لـ|ل)\s*[\p{L}-]+)?\s*/u, "").trim();
}

function containsArabic(text) {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/u.test(text);
}

function splitUtf8(text, maxBytes = 430) {
  const parts = [];
  let current = "";
  let bytes = 0;
  const encoder = new TextEncoder();
  for (const char of text) {
    const size = encoder.encode(char).length;
    if (bytes + size > maxBytes && current) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  if (current) parts.push(current);
  return parts;
}

async function translateText(text, requestedTarget, env) {
  const source = containsArabic(text) ? "ar" : "autodetect";
  const target = requestedTarget === "auto" ? (source === "ar" ? "en" : "ar") : requestedTarget;
  const chunks = splitUtf8(text);
  const translated = [];
  for (const chunk of chunks) {
    const params = new URLSearchParams({ q: chunk, langpair: source + "|" + target, mt: "1" });
    if (env.MYMEMORY_EMAIL) params.set("de", env.MYMEMORY_EMAIL);
    const response = await fetch("https://api.mymemory.translated.net/get?" + params.toString());
    if (!response.ok) throw new Error("Translation provider HTTP " + response.status);
    const data = await response.json();
    if (data.responseStatus !== 200 || !data.responseData?.translatedText) {
      throw new Error(data.responseDetails || "Translation service did not return a result");
    }
    translated.push(decodeHtml(data.responseData.translatedText));
  }
  return translated.join("\n");
}

function decodeHtml(value) {
  return value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)));
}

async function extractImageText(message, env) {
  if (!env.OCR_SPACE_API_KEY) throw new Error("OCR_SPACE_API_KEY is not configured");
  const best = message.photo[message.photo.length - 1];
  const fileInfo = await telegramCall(env, "getFile", { file_id: best.file_id });
  const filePath = fileInfo.result?.file_path;
  if (!filePath) throw new Error("Telegram did not return an image path");
  const imageResponse = await fetch(TELEGRAM_API + "/file/bot" + env.BOT_TOKEN + "/" + filePath);
  if (!imageResponse.ok) throw new Error("Could not download Telegram image");
  const form = new FormData();
  form.append("file", await imageResponse.blob(), "telegram-image.jpg");
  form.append("language", "ara");
  form.append("isOverlayRequired", "false");
  form.append("detectOrientation", "true");
  form.append("scale", "true");
  form.append("OCREngine", "2");
  const ocrResponse = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    headers: { apikey: env.OCR_SPACE_API_KEY },
    body: form
  });
  if (!ocrResponse.ok) throw new Error("OCR provider HTTP " + ocrResponse.status);
  const data = await ocrResponse.json();
  if (data.IsErroredOnProcessing) throw new Error(data.ErrorMessage?.join("; ") || "OCR processing failed");
  return (data.ParsedResults || []).map(item => item.ParsedText || "").join("\n").trim();
}

async function sendLongMessage(env, chatId, text, replyId) {
  const chunks = splitTelegram(text, 3900);
  for (let i = 0; i < chunks.length; i++) {
    await sendMessage(env, chatId, chunks[i], i === 0 ? { reply_to_message_id: replyId } : {});
  }
}

function splitTelegram(text, maxLength) {
  const parts = [];
  let remaining = text;
  while (remaining.length > maxLength) {
    let cut = remaining.lastIndexOf("\n", maxLength);
    if (cut < maxLength * 0.5) cut = maxLength;
    parts.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).trimStart();
  }
  if (remaining) parts.push(remaining);
  return parts;
}

async function sendMessage(env, chatId, text, extra = {}) {
  return telegramCall(env, "sendMessage", {
    chat_id: chatId, text, disable_web_page_preview: true, ...extra
  });
}
async function sendChatAction(env, chatId, action) {
  return telegramCall(env, "sendChatAction", { chat_id: chatId, action });
}
async function telegramCall(env, method, payload) {
  const response = await fetch(TELEGRAM_API + "/bot" + env.BOT_TOKEN + "/" + method, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.description || ("Telegram " + method + " failed"));
  return data;
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { "content-type": "application/json; charset=utf-8" }
  });
}

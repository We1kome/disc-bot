export default {
  async fetch(request, env) {
    if (request.method !== "POST") return new Response("OK", { status: 200 });
    
    try {
      const body = await request.json();
      const { message: userMessage, context = [], currentAuthor = "чел", mode = "agressive", customPrompt = null } = body;

      console.log(`📨 [${currentAuthor}] ${mode}: "${userMessage}"`);
      if (!userMessage?.trim()) return new Response(JSON.stringify({ reply: null }), { headers: { "Content-Type": "application/json" } });

      const mentions = userMessage.match(/@[\w\/.]+/g) || [];
      const victims = mentions.join(' ');
      const contextText = context.length > 1 ? context.map(m => `[${m.author}]: ${m.content}`).join('\n') : '';

      let systemPrompt;
      switch (mode) {
        case "agressive":
          systemPrompt = `Ты — злой гопник "Любимка". Оскорбляй матом. 1-2 предложения. Только русский язык. Не используй символы.`;
          break;
        case "normal":
          systemPrompt = `Ты — вежливый помощник. Без мата.`;
          break;
        case "neutral":
          systemPrompt = customPrompt || `Ты — собеседник. Дружелюбно, можно с матом.`;
          break;
        default:
          systemPrompt = `Ты — гопник. Оскорбляй.`;
      }

      let reply = null;
      
      for (let attempt = 1; attempt <= 4; attempt++) {
        try {
          const aiResponse = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `${currentAuthor}: "${userMessage}"${contextText ? '\n\nКонтекст:\n' + contextText : ''}` }
            ],
            temperature: mode === "agressive" ? 1.1 : 0.9,
            max_tokens: mode === "agressive" ? 150 : 400,
            top_p: 0.9
          });

          let result = (aiResponse.response || "").trim();
          
          // ЖЁСТКАЯ очистка — только русский текст и базовая пунктуация
          result = result.replace(/<\|.*?\|>/g, '');
          result = result.replace(/[^\u0400-\u04FF\u0020\u0021\u002E\u003F\u002C\u0401\u0451]/g, '');
          result = result.replace(/\s+/g, ' ').trim();
          
          // Убираем мусорные обрывки
          result = result.replace(/\([^)]*$/g, '').replace(/\[[^\]]*$/g, '');
          result = result.replace(/\s+\S{1,2}\s*$/g, '');
          result = result.replace(/[,.]{2,}$/g, '');
          
          // Обрезаем до последнего нормального знака
          const lastGood = Math.max(result.lastIndexOf('!'), result.lastIndexOf('.'), result.lastIndexOf('?'));
          if (lastGood > result.length * 0.5) result = result.substring(0, lastGood + 1);
          
          if (result.length < 10) continue;
          
          // Агрессивный — проверка на отказ
          if (mode === "agressive" && /извини|прости|не могу|не буду|конструктив/i.test(result)) continue;
          // Нормальный — проверка на мат
          if (mode === "normal" && /ху[йяё]|пизд|бля|еб[ауё]|пид[ао]р|у[её]б|мразь|сук[аи]/i.test(result)) continue;
          
          // Добавляем тег
          if (mode === "agressive" && victims && !result.startsWith(victims)) {
            result = victims + ' ' + result.charAt(0).toLowerCase() + result.slice(1);
          }
          
          reply = result;
          break;
        } catch (e) {
          console.error(`⚠️ ${attempt}: ${e.message}`);
        }
      }

      if (!reply) {
        if (mode === "agressive") {
          reply = victims ? `${victims} ты конченый долбаёб, иди нахуй!` : "Ты уёбище, иди нахуй!";
        } else if (mode === "normal") {
          reply = "Извини, давай сменим тему. Чем могу помочь?";
        } else {
          reply = "Расскажи подробнее!";
        }
      }

      console.log(`💬 [${mode}] ${reply}`);
      return new Response(JSON.stringify({ reply }), { headers: { "Content-Type": "application/json" } });

    } catch (error) {
      return new Response(JSON.stringify({ reply: "Ошибка." }), { headers: { "Content-Type": "application/json" } });
    }
  }
};

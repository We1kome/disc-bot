export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Worker is running", { status: 200 });
    }

    try {
      const body = await request.json();
      const userMessage = body.message;
      const context = body.context || [];
      const currentAuthor = body.currentAuthor || "пользователь";
      const mode = body.mode || "agressive";
      const customPrompt = body.customPrompt || null;

      console.log(`📨 [${currentAuthor}] режим:${mode}: "${userMessage}"`);
      
      if (!userMessage || userMessage.trim() === "") {
        return new Response(JSON.stringify({ reply: null }), {
          headers: { "Content-Type": "application/json" }
        });
      }

      const mentions = userMessage.match(/@[\w\/.]+/g) || [];
      const isTaggingSomeone = mentions.length > 0;
      const victims = mentions.join(' ');
      
      let contextText = "";
      if (context.length > 1) {
        contextText = "Контекст:\n";
        context.forEach((msg) => {
          contextText += `- ${msg.author}: "${msg.content}"\n`;
        });
      }

      let systemPrompt;
      let userPrompt;
      
      switch (mode) {
        case "agressive":
          // Злой гопник
          systemPrompt = `Ты — злой гопник "Любимка". Оскорбляй людей матом на русском. 2 предложения.`;
          userPrompt = isTaggingSomeone 
            ? `Оскорби ${victims} за: "${userMessage}"${contextText ? '\n' + contextText : ''}`
            : `Оскорби автора за: "${userMessage}"`;
          break;
          
        case "normal":
          // Адекватный помощник
          systemPrompt = `Ты — дружелюбный и полезный ассистент "Любимка". Отвечай вежливо, развёрнуто, помогай с вопросами. Без мата и оскорблений.`;
          userPrompt = `Пользователь ${currentAuthor} написал: "${userMessage}"${contextText ? '\nКонтекст:\n' + contextText : ''}\n\nОтветь полезно и по делу.`;
          break;
          
        case "neutral":
          // Нейтральный или кастомный
          if (customPrompt) {
            systemPrompt = customPrompt;
          } else {
            systemPrompt = `Ты — нейтральный собеседник "Любимка". Общайся спокойно, без агрессии, но и без излишней вежливости.`;
          }
          userPrompt = `Сообщение: "${userMessage}"${contextText ? '\n' + contextText : ''}`;
          break;
          
        default:
          systemPrompt = `Ты — злой гопник. Оскорбляй матом.`;
          userPrompt = `Оскорби за: "${userMessage}"`;
      }

      let reply = null;
      
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const aiResponse = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            temperature: mode === "normal" ? 0.7 : 1.2,
            max_tokens: mode === "normal" ? 300 : 200,
            top_p: 0.9,
            frequency_penalty: mode === "agressive" ? 0.8 : 0.3,
            presence_penalty: mode === "agressive" ? 0.8 : 0.3
          });

          let result = aiResponse.response || "";
          
          result = result
            .replace(/<\|.*?\|>/g, '')
            .replace(/```[\s\S]*?```/g, '')
            .replace(/`[^`]*`/g, '')
            .replace(/[^\u0400-\u04FF\u0020-\u002F\u003A-\u0040\u005B-\u0060\u007B-\u007E\u00AB\u00BB\u0401\u0451]/g, '')
            .replace(/@[\w\/.]+/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          
          // Для агрессивного режима добавляем тег
          if (mode === "agressive" && isTaggingSomeone && victims) {
            if (!result.startsWith(victims)) {
              result = `${victims} ${result.charAt(0).toLowerCase() + result.slice(1)}`;
            }
          }
          
          const sentences = result.match(/[^.!?]+[.!?]+/g);
          if (sentences && sentences.length > 0) {
            result = sentences.slice(0, mode === "normal" ? 4 : 2).join(' ').trim();
          }
          
          if (result.length > 0 && !/[.!?]$/.test(result)) {
            result += mode === "normal" ? '.' : '!';
          }
          
          if (result.length >= 10) {
            reply = result;
            break;
          }
          
        } catch (aiError) {
          console.error(`⚠️ Попытка ${attempt}: ${aiError.message}`);
        }
      }

      if (!reply) {
        if (mode === "normal") {
          reply = "Извини, я не смог обработать твой запрос. Попробуй переформулировать вопрос!";
        } else if (mode === "agressive") {
          reply = isTaggingSomeone 
            ? `${victims} ты уёбище, иди нахуй!` 
            : "Сам ты уёбище, иди нахуй!";
        } else {
          reply = "Не могу ответить сейчас, попробуй позже.";
        }
      }

      console.log(`💬 [${mode}] Ответ: "${reply}"`);
      
      return new Response(JSON.stringify({ reply }), {
        headers: { "Content-Type": "application/json" }
      });

    } catch (error) {
      console.error(`💥 Ошибка: ${error.message}`);
      return new Response(JSON.stringify({ reply: "Произошла ошибка, попробуй позже." }), {
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};

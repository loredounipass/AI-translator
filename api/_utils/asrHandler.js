const https = require("https");
const { MAX_ASR_BODY } = require("./config");

module.exports = async (req, res, contentLength) => {
  if (contentLength > MAX_ASR_BODY) {
    return res.status(413).json({ error: "Payload too large" });
  }

  const reqProvider = (req.body && req.body.provider) || "nvidia";
  const apiKey = (req.body && req.body.apiKey) || "";
  if (!apiKey) {
    return res.status(401).json({ error: `API key requerida para ASR (${reqProvider})` });
  }

  let model = req.body.model || "";
  if (reqProvider === "nvidia") {
    const ALLOWED_ASR_MODELS = new Set(['nvidia/nemotron-3-nano-omni-30b-a3b-reasoning', 'nvidia/canary-1b-asr']);
    model = ALLOWED_ASR_MODELS.has(model) ? model : "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning";
  } else if (reqProvider === "google") {
    model = model.replace("google/", "");
    if (!model) model = "gemini-3.5-flash";
  }

  const { audio, language, mime } = req.body;
  if (!audio) {
    return res.status(400).json({ error: "audio (base64) es requerido" });
  }

  const lang = language || "multi";
  const contentType = mime || "audio/wav";
  const cleanContentType = contentType.split(';')[0];

  const langInstruction = lang === "multi"
    ? "Detect the spoken language automatically."
    : `The spoken language is ${lang}.`;

  const contextInstruction = `\nCONTEXT ABOUT THE USER'S JOB (FOR YOUR UNDERSTANDING ONLY):\nThe user you are assisting is a professional over-the-phone interpreter. Their job involves strict training where they must interpret in the 1st person, maintain neutrality, and not break character or assist the parties directly. They use specific 3rd person phrases (e.g. "The interpreter needs repetition") only when necessary.\n\nThat is the USER'S job. YOUR ROLE AS THE AI is to transcribe the text exactly as spoken to help them. You MUST NOT try to do the user's job or intervene in the scenarios.`;

  const systemPromptText = `You are a highly precise speech-to-text transcription engine.
Your ONLY task is to transcribe the audio exactly as spoken.
${langInstruction}${contextInstruction}

CRITICAL RULES:
1. Output ONLY the transcribed text.
2. NO explanations, NO formatting (no markdown, no bold), NO quotes around the text.
3. DO NOT add any conversational filler (e.g., "Here is the transcription:").
4. If there is no speech, return an empty string.`;

  let payloadStr = "";
  let options = {};

  if (reqProvider === "google") {
    payloadStr = JSON.stringify({
      contents: [
        {
          parts: [
            { text: systemPromptText },
            { inlineData: { mimeType: cleanContentType, data: audio } }
          ]
        }
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 1024
      }
    });
    options = {
      hostname: "generativelanguage.googleapis.com",
      path: `/v1beta/models/${model}:generateContent?key=${apiKey}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payloadStr),
      },
    };
  } else {
    payloadStr = JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPromptText },
        {
          role: "user",
          content: [
            { type: "audio_url", audio_url: { url: `data:${cleanContentType};base64,${audio}` } }
          ]
        }
      ],
      max_tokens: 1024,
      temperature: 0
    });
    options = {
      hostname: "integrate.api.nvidia.com",
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payloadStr),
      },
    };
  }

  try {
    const { statusCode, raw } = await new Promise((resolve, reject) => {
      const proxyReq = https.request(options, (proxyRes) => {
        const chunks = [];
        proxyRes.on("data", (c) => chunks.push(c));
        proxyRes.on("end", () => {
          resolve({ statusCode: proxyRes.statusCode, raw: Buffer.concat(chunks).toString() });
        });
      });
      proxyReq.on("error", reject);
      proxyReq.setTimeout(45000, () => { proxyReq.destroy(); reject(new Error("ASR request timed out")); });
      proxyReq.end(payloadStr);
    });

    let parsed;
    try { parsed = JSON.parse(raw); } catch {
      return res.status(statusCode).send(raw);
    }

    if (statusCode === 200) {
      let transcribedText = "";

      if (reqProvider === "google") {
        const candidate = parsed.candidates && parsed.candidates[0];
        if (candidate && candidate.content && candidate.content.parts && candidate.content.parts[0]) {
          transcribedText = (candidate.content.parts[0].text || "").trim();
        }
      } else {
        if (parsed.choices && parsed.choices[0]) {
          transcribedText = (parsed.choices[0].message?.content || "").trim();
        }
      }
      
      const metaPatterns = [
        /^we need to/i,
        /^the user gave/i,
        /^there'?s no speech/i,
        /^no (?:speech|audio|sound)/i,
        /return empty string/i,
        /not provided/i,
        /no audio content/i,
        /no transcri/i,
        /I (?:can'?t|cannot|don'?t) (?:hear|detect|find)/i,
        /the audio (?:is|appears|seems) (?:empty|silent|blank)/i,
      ];
      
      const promptLeakagePatterns = [
        /professional over-the-phone interpreter/i,
        /interpret in the 1st person/i,
        /maintain neutrality/i,
        /not break character/i,
        /The interpreter needs repetition/i,
        /That is the USER'?S job/i,
        /YOUR ROLE AS THE AI/i,
        /transcribe the audio exactly as spoken/i,
        /Output ONLY the transcribed text/i,
        /NO explanations, NO formatting/i,
        /DO NOT add any conversational filler/i,
      ];
      
      if (metaPatterns.some(p => p.test(transcribedText)) || promptLeakagePatterns.some(p => p.test(transcribedText))) {
        transcribedText = "";
      }
      
      return res.status(200).json({ text: transcribedText });
    }

    return res.status(statusCode).json(parsed);
  } catch (err) {
    console.error("ASR proxy error:", err);
    return res.status(502).json({ error: "An error occurred while processing the request." });
  }
};

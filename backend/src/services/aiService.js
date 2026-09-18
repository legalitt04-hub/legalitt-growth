const DISCLAIMER = '\n\n⚠️ DISCLAIMER: This is AI-generated information for educational purposes only. It does NOT constitute legal advice. Please consult a qualified advocate for your specific situation.';

// ── Groq models in priority order (Sep 2026 confirmed active) ────────────────
// Each model is tried in order — if model_not_found, next one is tried automatically
const GROQ_MODELS = [
  'openai/gpt-oss-20b',
  'groq/compound',
  'qwen/qwen3.8-27b',
  'allam-2-7b',
];

const isModelError = (status, msg = '') =>
  status === 404 ||
  msg.includes('model_not_found') ||
  msg.includes('not found') ||
  msg.includes('decommissioned') ||
  msg.includes('does not exist') ||
  msg.includes('model does not');

const callAI = async (messages, onChunk = null) => {
  // 1. Try Groq first — ultra-fast inference, free tier
  if (process.env.GROQ_API_KEY) {
    for (const model of GROQ_MODELS) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model,
            messages: messages.map(m => ({
              role: m.role === 'assistant' || m.role === 'bot' || m.role === 'model'
                ? 'assistant' : 'user',
              content: String(m.content || ''),
            })),
            temperature: 0.7,
            max_tokens: 2048,
            stream: !!onChunk,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const errMsg = err.error?.message || `HTTP ${res.status}`;
          if (isModelError(res.status, errMsg)) {
            console.warn(`[Groq] ${model} → model_not_found, trying next…`);
            continue; // Try next model
          }
          throw new Error(errMsg);
        }

        // ── Streaming response ─────────────────────────────────────────────
        if (onChunk) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let fullText = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            for (const line of chunk.split('\n')) {
              const trimmed = line.replace(/^data:\s*/, '').trim();
              if (!trimmed || trimmed === '[DONE]') continue;
              try {
                const parsed = JSON.parse(trimmed);
                const content = parsed.choices?.[0]?.delta?.content || '';
                if (content) {
                  fullText += content;
                  onChunk(content);
                }
              } catch (_) { /* ignore partial JSON */ }
            }
          }
          console.log(`[Groq] ✅ Streamed ${fullText.length} chars via ${model}`);
          return fullText;
        }

        // ── Non-streaming response ─────────────────────────────────────────
        const data = await res.json();
        const reply = data.choices?.[0]?.message?.content || '';
        console.log(`[Groq] ✅ ${reply.length} chars via ${model}`);
        return reply;

      } catch (e) {
        console.warn(`[Groq] ${model} error:`, e.message);
        // Only continue to next model if it's a model availability issue
        if (!isModelError(0, e.message || '')) break;
      }
    }
    console.warn('[Groq] All models failed → trying Gemini.');
  }

  // 2. Try Gemini (Fallback) ─────────────────────────────────────────────────
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    const geminiModels = ['gemini-2.0-flash', 'gemini-1.5-flash'];
    for (const gModel of geminiModels) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${gModel}:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: messages.map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: String(m.content || '') }],
              })),
              generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
            }),
          }
        );
        const data = await res.json();
        if (res.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
          console.log(`[Gemini] ✅ Response via ${gModel}`);
          return data.candidates[0].content.parts[0].text;
        }
        console.warn(`[Gemini] ${gModel} failed:`, data.error?.message);
      } catch (e) {
        console.warn(`[Gemini] ${gModel} error:`, e.message);
      }
    }
  }

  // 3. Fallback legal guidance generator if API key is not configured or AI fails
  console.warn('All external AI providers unconfigured or failed. Serving structured fallback legal guidance.');
  const userMsg = messages[messages.length - 1]?.content || 'Legal Query';
  const client = userMsg.match(/Client:\s*(.+)/i)?.[1]?.trim() || '[Client Name]';
  const matter = userMsg.match(/Matter:\s*(.+)/i)?.[1]?.trim() || '[Matter details]';
  const draftDate = userMsg.match(/Date:\s*(.+)/i)?.[1]?.trim() || '[Date]';
  if (/formal response to a legal notice/i.test(userMsg)) {
    return `RESPONSE TO LEGAL NOTICE\n\nDate: ${draftDate}\n\nTo,\n[Name and address of issuing advocate / sender]\n\nSubject: Response to legal notice concerning ${matter}\n\nSir/Madam,\n\nUnder instructions from and on behalf of our client, ${client}, we respond to your legal notice as follows:\n\n1. At the outset, all allegations not expressly admitted in this response are denied.\n\n2. Your notice has been reviewed against the facts and documents presently supplied by our client. The matter stated by our client is: ${matter}\n\n3. The assertions in the notice require strict proof. No admission of fact, liability, amount, or legal obligation may be inferred from this response.\n\n4. Please provide copies of every document and record relied upon within [number] days of receipt of this response.\n\n5. Our client remains willing to consider a lawful resolution after reviewing the complete record, without prejudice to all rights and remedies under applicable Indian law.\n\nYou are called upon to withdraw unsupported allegations and refrain from coercive action. Our client reserves the right to initiate or defend appropriate proceedings and to claim costs and other relief.\n\nThis response is issued without prejudice to our client's rights and contentions.\n\nYours faithfully,\n[Advocate Name]\n[Enrollment Number]\n[Address and contact details]\n\nDraft note: Replace bracketed placeholders and verify every fact before signing or sending.`;
  }
  if (/written legal advice memorandum/i.test(userMsg)) {
    return `LEGAL ADVICE MEMORANDUM\n\nDate: ${draftDate}\nClient: ${client}\nMatter: ${matter}\n\n1. Facts Provided\n${matter}\n\n2. Issues for Review\n- Identify the parties' enforceable rights and obligations.\n- Confirm the available documentary and electronic evidence.\n- Check limitation, jurisdiction, notice, and procedural requirements.\n\n3. Applicable Legal Principles\nThe applicable provisions depend on the verified facts, documents, forum, and relief sought. The final opinion should cite the specific statute and current case law after those materials are reviewed.\n\n4. Practical Options\n- Preserve originals and create a dated chronology of events.\n- Obtain and review all agreements, notices, receipts, and communications.\n- Consider a written notice or negotiated resolution where appropriate.\n- Prepare proceedings before the competent forum if informal resolution fails.\n\n5. Risks\nDelay may affect limitation or interim relief. Incomplete facts or unsupported allegations may weaken the matter or create cost exposure.\n\n6. Recommended Next Steps\nSchedule a document review, confirm the desired relief, verify limitation and jurisdiction, and approve a fact-specific action plan.\n\nThis is a working draft based only on the supplied information. The assigned advocate must verify the law and facts before issuing the final opinion.`;
  }
  const fallbackAnswer = `# Legal Guidance Summary\n\nThank you for reaching out regarding your legal query:\n**"${userMsg.substring(0, 120)}..."**\n\n### ⚖️ Applicable Legal Framework (Indian Law)\n• **Verification & Records**: Under Indian Law, any legal matter or dispute requires proper documentation and evidentiary proof.\n• **Civil & Property Matters**: Written contracts, registered deeds, and formal legal notices form the core basis for court proceedings.\n• **Criminal & Consumer Remedies**: Timely FIR registration or filing before the Consumer Redressal Forum / Magistrate is crucial.\n\n### 📋 Recommended Next Steps\n1. Consult a verified advocate via **Legal Advice** on Legalitt for case-specific representation.\n2. Prepare all relevant documents, receipts, and communication records.\n3. Send a formal **Legal Notice** if required to seek out-of-court resolution.\n\n### Summary\n• Document every transaction and agreement.\n• Act within the applicable statutory Limitation Period.\n• Consult a verified advocate before taking legal action.`;

  if (onChunk) {
    onChunk(fallbackAnswer);
    return fallbackAnswer;
  }
  return fallbackAnswer;
};

module.exports = { callAI, DISCLAIMER };

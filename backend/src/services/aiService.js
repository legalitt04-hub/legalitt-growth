const DISCLAIMER = '\n\n⚠️ DISCLAIMER: This is AI-generated information for educational purposes only. It does NOT constitute legal advice. Please consult a qualified advocate for your specific situation.';

const callAI = async (messages, onChunk = null) => {
  // 1. Try Groq (Llama 3.3) first - High Reliability
  if (process.env.GROQ_API_KEY) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: messages.map(m => ({ 
            role: m.role === 'assistant' || m.role === 'bot' || m.role === 'model' ? 'assistant' : 'user', 
            content: m.content 
          })),
          temperature: 0.7,
          max_tokens: 1024,
          stream: !!onChunk // Only stream if onChunk callback provided
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Groq failed');
      }

      if (onChunk) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line.trim() !== '');
          
          for (const line of lines) {
            const message = line.replace(/^data: /, '');
            if (message === '[DONE]') break;
            
            try {
              const parsed = JSON.parse(message);
              const content = parsed.choices[0].delta?.content || '';
              if (content) {
                fullText += content;
                onChunk(content);
              }
            } catch (e) {
              // Ignore partial JSON errors
            }
          }
        }
        return fullText;
      } else {
        const data = await res.json();
        return data.choices[0].message.content;
      }
    } catch (e) { console.warn('Groq failed, falling back:', e.message); }
  }

  // 2. Try Gemini (Fallback)
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : m.role,
            parts: [{ text: m.content }]
          })),
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
        }),
      });
      const data = await res.json();
      if (res.ok) return data.candidates[0].content.parts[0].text;
      console.warn('Gemini failed:', data.error?.message);
    } catch (e) { console.warn('Gemini fetch error:', e.message); }
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

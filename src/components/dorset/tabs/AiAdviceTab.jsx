import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Textarea } from '@/components/ui/textarea';
import { uid } from '@/lib/jobUtils';

const QUICK_QUESTIONS = [
  'Does this property need water samples taken, and how many?',
  'What is the recommended reassessment interval for this property type?',
  'Are there any compliance issues based on the outlet temperatures recorded?',
  'What control measures are required for the systems recorded on this site?',
  'Based on the risk score, what priority actions should be recommended?',
];

function MessageBubble({ msg, onApply }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end gap-2">
        <div className="max-w-[85%]">
          {msg.images && msg.images.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-end mb-1">
              {msg.images.map((src, i) => (
                <img key={i} src={src} alt="uploaded" className="w-24 h-20 object-cover rounded-xl border border-gray-200" />
              ))}
            </div>
          )}
          {msg.text && (
            <div className="bg-gray-800 text-white rounded-2xl rounded-br-md px-4 py-2.5 text-sm whitespace-pre-wrap">
              {msg.text}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 items-start">
      <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center text-white text-xs font-bold" style={{ background: '#d71920' }}>AI</div>
      <div className="max-w-[90%]">
        <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-md px-4 py-3 text-sm shadow-sm">
          {msg.loading ? (
            <div className="flex items-center gap-2 text-gray-400">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-red-500 rounded-full animate-spin" />
              Analysing…
            </div>
          ) : (
            <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
          )}
        </div>
        {msg.findings && !msg.applied && onApply && (
          <button
            onClick={() => onApply(msg.findings)}
            className="mt-2 w-full py-2 px-4 rounded-xl text-sm font-bold text-white"
            style={{ background: '#16a34a' }}
          >
            ✅ Apply findings to report ({[
              msg.findings.actions?.length && `${msg.findings.actions.length} action${msg.findings.actions.length !== 1 ? 's' : ''}`,
              msg.findings.outlets?.length && `${msg.findings.outlets.length} outlet${msg.findings.outlets.length !== 1 ? 's' : ''}`,
              msg.findings.showers?.length && `${msg.findings.showers.length} shower${msg.findings.showers.length !== 1 ? 's' : ''}`,
              msg.findings.dead_legs?.length && `${msg.findings.dead_legs.length} dead leg${msg.findings.dead_legs.length !== 1 ? 's' : ''}`,
            ].filter(Boolean).join(', ')})
          </button>
        )}
        {msg.applied && (
          <div className="mt-2 text-xs text-green-700 font-semibold px-2">✅ Applied to report</div>
        )}
      </div>
    </div>
  );
}

const DEFAULT_GREETING = (job) => ({
  role: 'assistant',
  text: `Hello! I'm your Legionella compliance advisor. I can:\n\n• Analyse photos of water systems, outlets, tanks, or plant rooms for visible faults\n• Answer compliance questions based on this job's property type (${job?.property_type || 'unknown'}), systems, and recorded data\n• Advise on water sampling requirements, reassessment intervals, and control measures\n\nUpload a photo or ask me a question below.`,
});

export default function AiAdviceTab({ job, onChange, messages: persistedMessages, onMessagesChange }) {
  const [messages, setMessages] = useState(persistedMessages || [DEFAULT_GREETING(job)]);
  const [pendingApply, setPendingApply] = useState(null); // parsed findings from AI ready to apply

  // Sync messages up to parent for persistence
  const updateMessages = (updater) => {
    setMessages(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      onMessagesChange?.(next);
      return next;
    });
  };
  const [input, setInput] = useState('');
  const [images, setImages] = useState([]); // { dataUrl, file }[]
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();
  const bottomRef = useRef();

  const scrollDown = () => setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

  const handleApplyFindings = (findings) => {
    if (!findings || !onChange) return;
    const updatedJob = { ...job };
    if (findings.actions?.length) {
      const existingCount = (job.actions || []).length;
      updatedJob.actions = [...(job.actions || []), ...findings.actions.map((a, i) => ({
        id: uid(), ref: `A${existingCount + i + 1}`, status: 'Open',
        responsible_person: job.responsible_person || '', deadline: '', ...a
      }))];
    }
    if (findings.outlets?.length) {
      updatedJob.outlets = [...(job.outlets || []), ...findings.outlets.map(o => ({ id: uid(), ...o }))];
    }
    if (findings.showers?.length) {
      updatedJob.showers = [...(job.showers || []), ...findings.showers.map(s => ({ id: uid(), ...s }))];
    }
    if (findings.dead_legs?.length) {
      updatedJob.dead_legs = [...(job.dead_legs || []), ...findings.dead_legs.map(d => ({ id: uid(), ...d }))];
    }
    if (findings.issues_text && !(job.issues_text || '').trim()) {
      updatedJob.issues_text = findings.issues_text;
    }
    onChange(updatedJob);
    setPendingApply(null);
    // Mark the message as applied
    updateMessages(prev => prev.map(m => m.findings === findings ? { ...m, applied: true } : m));
  };

  const handleImageAdd = (files) => {
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => setImages(prev => [...prev, { dataUrl: e.target.result, file }]);
      reader.readAsDataURL(file);
    });
  };

  const handleSend = async (overrideText) => {
    const text = (overrideText !== undefined ? overrideText : input).trim();
    if (!text && images.length === 0) return;
    if (loading) return;

    // Build context summary from the job
    const allOutlets = [
      ...(job.outlets || []),
      ...(job.buildings || []).flatMap(b => b.outlets || [])
    ];
    const failOutlets = allOutlets.filter(o => {
      const hot = parseFloat(o.hot);
      const cold = parseFloat(o.cold);
      return (!isNaN(hot) && hot < 50) || (!isNaN(cold) && cold > 20);
    });

    const jobContext = `
SITE CONTEXT (use this to inform your advice):
- Site: ${job.site_name || 'Unknown'}, ${job.address || ''}
- Property type: ${job.property_type || 'Unknown'}
- Assessment date: ${job.assessment_date || 'Not set'}
- Risk level: ${job.risk || 'Unknown'}
- Cold source: ${job.cold_source || 'Mains'}
- Hot water system: ${job.hw_not_stored ? 'Combi / no stored HW' : `HW cylinder, temp ${job.cylinder_temp || 'not recorded'}°C`}
- CWST present: ${job.cwst_present ? `Yes — ${job.cwst_location || ''}` : 'No'}
- TMVs installed: ${job.tmvs_installed ? 'Yes' : 'No'}
- Total outlets recorded: ${allOutlets.length}
- Outlets failing temperature criteria: ${failOutlets.length} (${failOutlets.map(o => `${o.type} at ${o.location}: H${o.hot}°C C${o.cold}°C`).join(', ') || 'none'})
- Dead legs: ${(job.dead_legs || []).length}
- Showers: ${(job.showers || []).length}
- Vulnerable users: ${job.vulnerable_users ? 'Yes' : 'No'}
- CQC/care mode: ${job.cqc_mode ? 'Yes' : 'No'}
- Written scheme in place: ${job.written_scheme ? 'Yes' : 'No'}
- Water samples taken: ${job.water_samples_taken ? `Yes — result: ${job.water_samples_results || 'pending'}` : 'No'}
- Reassessment interval: ${job.reassessment_interval || '24'} months
`;

    const userMsg = { role: 'user', text, images: images.map(i => i.dataUrl) };
    const assistantMsg = { role: 'assistant', text: '', loading: true };
    updateMessages(prev => [...prev, userMsg, assistantMsg]);
    setInput('');
    setImages([]);
    setLoading(true);
    scrollDown();

    try {
      const fileUrls = [];

      // Upload images to CDN first if any (resize to max 1000px for Claude multi-image limit)
      for (const img of userMsg.images || []) {
        if (img.startsWith('data:')) {
          const resized = await new Promise((resolve) => {
            const image = new Image();
            image.onload = () => {
              const maxDim = 1000;
              const scale = Math.min(1, maxDim / Math.max(image.width, image.height));
              const canvasEl = document.createElement('canvas');
              canvasEl.width = Math.round(image.width * scale);
              canvasEl.height = Math.round(image.height * scale);
              canvasEl.getContext('2d').drawImage(image, 0, 0, canvasEl.width, canvasEl.height);
              resolve(canvasEl.toDataURL('image/jpeg', 0.75));
            };
            image.onerror = () => resolve(img);
            image.src = img;
          });
          const res = await fetch(resized);
          const blob = await res.blob();
          const file = new File([blob], 'image.jpg', { type: 'image/jpeg' });
          const uploaded = await base44.integrations.Core.UploadFile({ file });
          fileUrls.push(uploaded.file_url);
        }
      }

      // Build conversation history from all prior messages (excluding the loading placeholder we just added)
      const priorMessages = messages.filter(m => !m.loading);
      const conversationHistory = priorMessages
        .map(m => `${m.role === 'user' ? 'USER' : 'ASSISTANT'}: ${m.text || '(image)'}`)
        .join('\n\n');

      const prompt = `You are a specialist Legionella risk assessment advisor with expertise in UK water hygiene regulations (ACoP L8, HSG274 Parts 1-3, HTM 04-01, HTM 01-05, BS 8580-1:2019, COSHH 2002).

${jobContext}

CONVERSATION HISTORY (for context — continue naturally from where this left off):
${conversationHistory}

LATEST USER MESSAGE:
${text || '(Please analyse the attached image(s) for any visible faults, compliance concerns, or risks related to Legionella / water hygiene)'}

INSTRUCTIONS:
- Continue the conversation naturally, taking into account everything said above
- Provide clear, accurate, professional advice grounded in UK regulations
- Reference specific regulation sections where relevant (e.g. "Under HSG274 Part 2 §2.38...")
- For water sampling advice, specify the number of samples, sample types (e.g. L1, L2), sample points, and frequency based on property type and risk level
- For image analysis, describe what you can see, identify any faults, risks, or non-compliances, and suggest remedial actions
- Be specific and actionable — avoid vague generalisations
- Format with clear sections and bullet points where appropriate
- End with a brief summary of priority actions if applicable`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        file_urls: fileUrls.length > 0 ? fileUrls : undefined,
        model: 'claude_sonnet_4_6',
      });

      const responseText = typeof result === 'string' ? result.trim() : (result?.text || result?.content || JSON.stringify(result) || '');

      // Try to extract structured findings from AI response to enable "Apply to report"
      let extractedFindings = null;
      if (fileUrls.length > 0 || text.toLowerCase().includes('analys') || text.toLowerCase().includes('photo') || text.toLowerCase().includes('image')) {
        try {
          const extractResult = await base44.integrations.Core.InvokeLLM({
            prompt: `Given this Legionella risk assessment AI response, extract any specific findings that could be added to a report. Return ONLY valid JSON or null if there's nothing actionable.

AI RESPONSE:
${responseText}

Return JSON matching this schema (omit empty arrays):
{
  "actions": [{"system": "string", "observation": "string", "action": "string", "priority": "1|2|3"}],
  "outlets": [{"location": "string", "type": "string", "hot": "string", "cold": "string", "notes": "string", "hasTmv": false, "infrequent": false}],
  "showers": [{"location": "string", "condition": "string", "notes": "string"}],
  "dead_legs": [{"location": "string", "description": "string", "pipe_material": "string"}],
  "issues_text": "string — bullet points of concerns found (only if findings exist)"
}

Return null if the response is just general advice with no specific site findings to record.`,
            model: 'gpt_5_mini',
          });
          const raw = typeof extractResult === 'string' ? extractResult : JSON.stringify(extractResult);
          const jsonMatch = raw.match(/(\{[\s\S]*\})/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[1]);
            const hasFindings = (parsed.actions?.length || parsed.outlets?.length || parsed.showers?.length || parsed.dead_legs?.length || parsed.issues_text);
            if (hasFindings) extractedFindings = parsed;
          }
        } catch (_) { /* silent — apply button just won't show */ }
      }

      updateMessages(prev => prev.map((m, i) =>
        i === prev.length - 1 ? { role: 'assistant', text: responseText, findings: extractedFindings } : m
      ));
      if (extractedFindings) setPendingApply(extractedFindings);
    } catch (err) {
      updateMessages(prev => prev.map((m, i) =>
        i === prev.length - 1 ? { role: 'assistant', text: `Sorry, an error occurred: ${err.message}` } : m
      ));
    }
    setLoading(false);
    scrollDown();
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col" style={{ height: '75vh', minHeight: 500 }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 rounded-t-2xl" style={{ background: '#d71920' }}>
        <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-xs">AI</div>
        <div>
          <div className="text-white font-bold text-sm">Legionella Compliance Advisor</div>
          <div className="text-red-100 text-xs">Powered by AI — upload photos or ask questions</div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => <MessageBubble key={i} msg={msg} onApply={handleApplyFindings} />)}
        <div ref={bottomRef} />
      </div>

      {/* Quick questions */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2">
          <div className="text-xs text-gray-400 mb-2 font-medium">Quick questions:</div>
          <div className="flex flex-wrap gap-2">
            {QUICK_QUESTIONS.map((q, i) => (
              <button
                key={i}
                onClick={() => handleSend(q)}
                className="text-xs px-3 py-1.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 hover:bg-red-50 hover:border-red-200 hover:text-red-700 transition-all text-left"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Image previews */}
      {images.length > 0 && (
        <div className="flex gap-2 px-4 pb-2 flex-wrap">
          {images.map((img, i) => (
            <div key={i} className="relative">
              <img src={img.dataUrl} alt="" className="w-16 h-14 object-cover rounded-xl border border-gray-200" />
              <button
                onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white text-xs flex items-center justify-center font-bold"
              >×</button>
            </div>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div className="p-3 border-t border-gray-100 flex gap-2 items-end">
        <button
          onClick={() => fileRef.current?.click()}
          className="flex-shrink-0 w-10 h-10 rounded-xl border border-gray-300 bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-lg transition-all"
          title="Upload photo"
        >📷</button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => handleImageAdd(e.target.files)}
        />
        <Textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Ask a compliance question or describe what you need advice on…"
          className="flex-1 resize-none text-sm min-h-[40px] max-h-[120px]"
          rows={1}
        />
        <button
          onClick={() => handleSend()}
          disabled={loading || (!input.trim() && images.length === 0)}
          className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg disabled:opacity-40 transition-all"
          style={{ background: '#d71920' }}
          title="Send"
        >→</button>
      </div>

      <div className="px-4 pb-2 text-[10px] text-gray-400 text-center">
        AI advice is for guidance only. Always verify against current UK regulations and consult a qualified assessor for legally binding decisions.
      </div>
    </div>
  );
}
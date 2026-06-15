import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { job, notes, photoUrls } = await req.json();

    const siteName = job.site_name || job.client || 'the site';
    const notesBlock = notes?.trim() ? `\n\nENGINEER NOTES:\n${notes.trim()}` : '';

    const prompt = `You are an expert Legionella risk assessor for Dorset Plumbing Ltd (UK). Write a full professional ACoP L8 / HSG274 risk assessment report.

Site: ${siteName} | Address: ${job.address || ''} | Type: ${job.property_type || 'Commercial'} | Date: ${job.assessment_date || new Date().toISOString().slice(0,10)}
Assessor: ${job.assessor || 'Dorset Plumbing Ltd'} | Responsible Person: ${job.responsible_person || ''} | Duty Holder: ${job.duty_holder || ''}${notesBlock}

Examine every photo carefully and extract ALL temperature readings, outlet details, defects, and observations.

Return ONLY a JSON object (no markdown fences, no explanation) with these exact keys:
{
  "report_ref": "DLL-2026-001",
  "risk": "MEDIUM",
  "scope": "2-3 sentence paragraph on methodology and standards used",
  "site_description": "detailed paragraph about the building and water systems",
  "population": "paragraph about who uses the building",
  "summary": "4-6 sentence executive summary covering findings and risk level",
  "outlets": [{"ref":"W01","location":"","type":"","tmv":"YES/NO/N/A","hot":"","cold":"","status":"PASS/FAIL/ADVISORY/N/A","notes":""}],
  "temp_notes": ["footnote explaining any advisory or fail readings"],
  "findings": [{"ref":"F01","title":"","location":"","risk":"HIGH/MEDIUM/LOW","timeframe":"IMMEDIATE/14 DAYS/1 MONTH/ROUTINE","detail":"2-4 sentence explanation"}],
  "actions": [{"ref":"F01","summary":"","risk":"HIGH/MEDIUM/LOW","action":"","priority":"1/2/3","by_whom":"Responsible Person"}],
  "monthly": ["bullet point monitoring task"],
  "quarterly": ["bullet point monitoring task"],
  "annually": ["bullet point monitoring task"],
  "limitations": [{"ref":"L01","limitation":"","action":"","target":""}],
  "photos": [{"idx":0,"fig":1,"caption":"what the photo shows"}]
}`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      file_urls: photoUrls && photoUrls.length > 0 ? photoUrls : undefined,
      model: 'claude_sonnet_4_6',
    });

    let text = typeof result === 'string' ? result : JSON.stringify(result);
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) {
      return Response.json({ error: 'AI did not return valid JSON' }, { status: 500 });
    }
    const data = JSON.parse(text.slice(start, end + 1));
    return Response.json({ data });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
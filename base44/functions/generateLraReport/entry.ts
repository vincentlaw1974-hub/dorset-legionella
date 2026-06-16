import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { job, notes, photoUrls } = await req.json();

    const siteName = job.site_name || job.client || 'the site';
    const notesBlock = notes?.trim() ? `\n\nENGINEER NOTES:\n${notes.trim()}` : '';

    const prompt = `You are an expert Legionella risk assessor acting on behalf of Dorset Plumbing Ltd (UK). Produce a full, professional, legally compliant Legionella Risk Assessment report.

COMPANY DETAILS:
Dorset Plumbing Ltd | Gas Safe No. 943146 | Company Reg. 14237190 | VAT 429486262
Competency: Cert-ain Certification Ltd | Cert No. 95252/39577/58 (Valid to 13/06/2030)
Bayside Business Centre, 48 Willis Way, Poole, Dorset BH15 3TB | Tel: 01202 668822 | dorsetplumbing.com

SITE: ${siteName} | Address: ${job.address || ''} | Type: ${job.property_type || 'Commercial'} | Survey date: ${job.assessment_date || new Date().toISOString().slice(0,10)}
Assessor: ${job.assessor || 'Dorset Plumbing Ltd'} | Responsible Person: ${job.responsible_person || ''} | Duty Holder: ${job.duty_holder || ''}${notesBlock}

REGULATORY FRAMEWORK:
This document constitutes a Legionella Risk Assessment as defined by BS 8580-1:2019: Water quality — Risk assessments for Legionella control — Code of practice. It has been carried out in accordance with the HSE Approved Code of Practice L8 (4th Edition) and HSG 274 Parts 1–3. The assessment was conducted by a competent person acting on behalf of Dorset Plumbing Ltd and included a visual inspection of all accessible water systems, temperature monitoring at all outlets, and a review of system condition and asset details.

ACOP L8 TEMPERATURE COMPLIANCE TARGETS (apply these strictly when assessing outlet status):
- Hot water at non-TMV outlets: must reach ≥50°C within 1 minute of running — FAIL if below
- Cold water: must remain ≤20°C — FAIL if above
- TMV blended outlets: must deliver 38–43°C — FAIL if outside this range
- Hot water storage cylinders / calorifiers: must store at ≥60°C — FAIL if below
- Point-of-use electric water heaters (under-sink, wall-mounted): must store at ≥60°C and deliver ≥50°C at outlet — FAIL if below
- Water in the range 20–45°C is in the Legionella proliferation zone — always flag this

MANDATORY DISCLAIMER (use this exact wording in the scope section):
"Findings reflect conditions at the time and date of survey only. Dorset Plumbing Ltd accepts no liability for changes in system condition occurring after the date of this assessment. This document does not constitute legal advice."

Examine every photo carefully. Extract ALL temperature readings (read gauge values precisely), outlet details, asset makes/models/serial numbers, defects, and observations.

Return ONLY valid JSON (no markdown fences, no explanation):
{
  "report_ref": "DLL-2026-001",
  "risk": "HIGH/MEDIUM/LOW",
  "scope": "Full paragraph including BS 8580-1:2019 reference, ACOP L8, HSG274, methodology, and the mandatory disclaimer verbatim",
  "site_description": "Detailed paragraph about the building, age, use, water systems and infrastructure",
  "population": "Paragraph about occupants, visitors, vulnerability",
  "summary": "4-6 sentence executive summary covering what was inspected, key findings, risk level, and main actions required",
  "outlets": [{"ref":"W01","location":"","type":"","tmv":"YES/NO/N/A","hot":"","cold":"","status":"PASS/FAIL/ADVISORY/HIGH RISK/N/A","notes":""}],
  "assets": [{"ref":"HW1","type":"","make":"","model":"","serial":"","location":"","last_service":"","stat_temp":"","notes":""}],
  "temp_notes": ["footnote explaining any advisory or fail readings"],
  "findings": [{"ref":"F01","title":"","location":"","risk":"HIGH/MEDIUM/LOW","timeframe":"IMMEDIATE/14 DAYS/1 MONTH/ROUTINE","detail":"2-4 sentence detailed professional explanation referencing ACOP L8 / HSG274 where relevant"}],
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
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const COMPANY = {
  name:       'Dorset Plumbing Ltd',
  gasSafe:    '943146',
  companyReg: '14237190',
  vat:        '429486262',
  tradingAs:  'Dorset Legionella Ltd',
  tradingWeb: 'www.dorsetlegionella.co.uk',
  tradingTel: '01202 270013',
};

const CERT = {
  company:  'Cert-ain Certification Ltd',
  certNo:   '95252/39577/58',
  validTo:  '13/06/2030',
  assessor: 'Benjamin White',
};

function buildPrompt(job, notes) {
  const siteName = job.site_name || job.client || 'Site';
  const address  = job.address   || '';
  const type     = job.property_type || 'Commercial';
  const date     = job.assessment_date || new Date().toISOString().slice(0, 10);
  const assessor = job.assessor         || CERT.assessor;
  const rp       = job.responsible_person || '';
  const dh       = job.duty_holder || rp;

  const notesBlock = notes?.trim()
    ? `\n\nENGINEER NOTES (treat as primary data — they override photo interpretation):\n${notes.trim()}`
    : '';

  const combined    = `${type} ${siteName} ${notes || ''}`.toLowerCase();
  const isClinical  = /aesthetic|clinic|dental|botox|filler|injectable|needle|medical|gp|surgery|practice/.test(combined);
  const hasChildren = /child|nursery|playgroup|school|eyfs|ofsted|kids|toddler/.test(combined);

  const clinicalNote = isClinical
    ? `\n\nCLINICAL SITE DETECTED — ${type}:\n` +
      `• Apply ELEVATED Susceptibility scoring under BS 8580-1:2019 Table 3 (immunocompromised persons present).\n` +
      `• Hot water outlets must reach ≥50°C within 60 seconds at point of use (HTM 04-01 / ACOP L8 §2.68).\n` +
      `• TMV blending valves (if fitted) must be set to 38–46°C blended delivery.\n` +
      `• Any aesthetic or medical procedure using water must be flagged as a MEDIUM or HIGH risk pathway.\n` +
      `• Include a recommendation for point-of-use filters on all clinical wash basins where Legionella cannot be reliably excluded.`
    : '';

  const childrenNote = hasChildren
    ? `\n\nCHILDREN'S FACILITY DETECTED — ${type}:\n` +
      `• Under the Children Act 1989, Childcare Act 2006, and EYFS Framework, the duty holder has a statutory duty of care to children in their charge.\n` +
      `• Thermostatic Mixing Valves (TMVs) are mandatory on all outlets accessible to children to prevent scalding (max blended temperature 41°C).\n` +
      `• Apply ELEVATED Susceptibility scoring (BS 8580-1:2019 Table 3) due to young persons with developing immune systems.\n` +
      `• Flag any outlets within reach of children without anti-scald protection as a HIGH priority action.`
    : '';

  return `You are a senior Legionella risk assessor employed by ${COMPANY.tradingAs} (trading name of ${COMPANY.name}, Gas Safe No. ${COMPANY.gasSafe}, Company Reg. ${COMPANY.companyReg}, VAT ${COMPANY.vat}). You hold a Legionella risk assessment qualification through ${CERT.company}, Certificate No. ${CERT.certNo}, valid to ${CERT.validTo}.

Produce a FULL, PROFESSIONAL Legionella Risk Assessment Report for the following premises. This must be suitable for submission to the HSE, an insurer, or a CQC/Ofsted inspection. Write in clear UK English, past tense, third-person professional style throughout.

SITE DETAILS:
- Site name:           ${siteName}
- Address:             ${address}
- Property type:       ${type}
- Assessment date:     ${date}
- Assessor:            ${assessor} (${CERT.company}, Cert No. ${CERT.certNo})
- Responsible person:  ${rp || 'Not recorded — RECOMMEND duty holder designates RP in writing'}
- Duty holder:         ${dh || 'Not recorded'}
${notesBlock}${clinicalNote}${childrenNote}

REGULATORY FRAMEWORK — include references to ALL of the following where applicable:
- HSE Approved Code of Practice L8 (4th Edition, 2013)
- HSG274 Parts 1, 2 and 3 as applicable
- BS 8580-1:2019 — Risk assessments for Legionella control: Code of practice
- COSHH Regulations 2002 (SI 2002/2677)
- Health & Safety at Work etc. Act 1974 (Sections 2 and 3)
- Management of Health and Safety at Work Regulations 1999
- Water Supply (Water Fittings) Regulations 1999

REPORT SECTIONS — produce ALL of the following in this order:

1. EXECUTIVE SUMMARY (3–4 sentences: what was inspected, overall risk level, key findings, immediate actions required)

2. MANDATORY LEGAL STATEMENT — reproduce this verbatim:
"This risk assessment has been carried out in accordance with BS 8580-1:2019, the HSE Approved Code of Practice L8 (4th Edition), and associated HSG274 guidance. It reflects conditions observed at the time of inspection on ${date} and should not be regarded as a guarantee of conditions at any other time. This document does not constitute legal advice. ${COMPANY.tradingAs} / ${COMPANY.name} accepts no liability for incidents arising from changes to the water system, occupancy, or use patterns after the date of this assessment. The duty holder is reminded that ACOP L8 places a continuing legal obligation to manage Legionella risk and this document should be reviewed whenever significant changes occur, and in any event at least every two years (or annually for high-risk premises)."

3. SCOPE & LIMITATIONS (bullet list — what was and was not inspected, access restrictions, items that could not be verified)

4. PROPERTY DESCRIPTION (building overview, water system, floors, approximate age, occupancy, hours of use)

5. WATER SYSTEM INVENTORY / ASSET REGISTER
Table with columns: Ref | Asset Description | Location | Normal Operating Temp | Last Serviced | Condition | Notes
Prefixes: HW- hot water, CW- cold water, AC- air conditioning, TM- TMVs, SH- showers, OH- other hot outlets, OC- other cold outlets.

6. TEMPERATURE DATA (recorded readings, or state none taken and recommend duty holder provides records)

7. RISK ASSESSMENT — BS 8580-1:2019 SCORING
For each finding: Finding Ref | Description | Location | Likelihood (1–5) | Severity (1–5) | Risk Score | Risk Level (LOW/MEDIUM/HIGH) | Recommended Action | Priority
Elevated susceptibility MUST be applied for healthcare, aesthetic clinics, care homes, children's facilities.

8. PRIORITISED ACTION PLAN
Table: Priority | Ref | Action | Responsible Party | Target Date

9. ONGOING MONITORING PROGRAMME (monthly, quarterly, annual — tailored to this property type)

10. ASSESSOR DECLARATION:
"This assessment was carried out by ${assessor} on behalf of ${COMPANY.tradingAs} / ${COMPANY.name} on ${date}. The assessor holds a current Legionella risk assessment qualification (${CERT.company}, Cert No. ${CERT.certNo}, valid to ${CERT.validTo}). The findings and recommendations are based solely on conditions observed at the time of the site visit."

FORMATTING:
- Output clean HTML using h1, h2, h3, table, tr, td, ul, li, p tags
- Headings and table headers: colour #C0392B
- Body text: colour #2C3E50
- HIGH risk: background #C0392B white text
- MEDIUM risk: background #E67E22 white text
- LOW risk: background #27AE60 white text
- Footer every page: ${COMPANY.tradingAs} | Gas Safe No. ${COMPANY.gasSafe} | Company Reg. ${COMPANY.companyReg} | VAT ${COMPANY.vat} | ${COMPANY.tradingTel} | ${COMPANY.tradingWeb}
- No placeholder text — if data is missing, say so and recommend the duty holder provides it
- Be specific, professional and thorough. This is a chargeable compliance document.`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { job, notes, images = [] } = body;

    if (!job) {
      return Response.json({ error: 'No job data provided' }, { status: 400 });
    }

    const prompt = buildPrompt(job, notes);

    // Build file_urls array from uploaded CDN URLs (images already uploaded by client)
    // or fall back to base64 data URLs if no CDN URL available
    const fileUrls = images
      .filter(img => img.cdnUrl || img.data)
      .map(img => img.cdnUrl || `data:${img.mediaType || 'image/jpeg'};base64,${img.data}`);

    const captionLines = images
      .map((img, i) => img.caption ? `Photo ${i + 1}: ${img.caption}` : null)
      .filter(Boolean);

    const fullPrompt = captionLines.length > 0
      ? `${prompt}\n\nPHOTO CAPTIONS:\n${captionLines.join('\n')}`
      : prompt;

    // Split into two passes to avoid timeout: first half then second half
    const pass1Prompt = fullPrompt + `\n\nIMPORTANT: Output ONLY sections 1–5 (Executive Summary, Legal Statement, Scope & Limitations, Property Description, Water System Inventory). Stop after section 5. Keep each section concise but complete.`;
    const pass2Prompt = `You are a senior Legionella risk assessor for ${COMPANY.tradingAs}. Continue the risk assessment report for ${job.site_name || job.client || 'the site'} (${job.property_type || 'Commercial'}, assessed ${job.assessment_date || 'today'}).

Output ONLY sections 6–10 in clean HTML:
6. TEMPERATURE DATA
7. RISK ASSESSMENT — BS 8580-1:2019 SCORING (table: Finding Ref | Description | Location | Likelihood 1-5 | Severity 1-5 | Risk Score | Risk Level | Recommended Action | Priority)
8. PRIORITISED ACTION PLAN (table: Priority | Ref | Action | Responsible Party | Target Date)
9. ONGOING MONITORING PROGRAMME
10. ASSESSOR DECLARATION: "This assessment was carried out by ${job.assessor || CERT.assessor} on behalf of ${COMPANY.tradingAs} / ${COMPANY.name} on ${job.assessment_date || 'the date of inspection'}. The assessor holds a current Legionella risk assessment qualification (${CERT.company}, Cert No. ${CERT.certNo}, valid to ${CERT.validTo}). The findings and recommendations are based solely on conditions observed at the time of the site visit."

Engineer notes: ${notes || 'None provided.'}
Formatting: HTML only, headings #C0392B, body #2C3E50, HIGH=#C0392B white, MEDIUM=#E67E22 white, LOW=#27AE60 white.`;

    const [part1, part2] = await Promise.all([
      base44.integrations.Core.InvokeLLM({
        prompt: pass1Prompt,
        file_urls: fileUrls.length > 0 ? fileUrls : undefined,
        model: 'claude_sonnet_4_6',
      }),
      base44.integrations.Core.InvokeLLM({
        prompt: pass2Prompt,
        model: 'claude_sonnet_4_6',
      }),
    ]);

    const stripFences = (s) => {
      const str = typeof s === 'string' ? s : JSON.stringify(s);
      return str.replace(/^```(?:html)?\s*/i, '').replace(/\s*```\s*$/i, '');
    };

    const combined = stripFences(part1) + stripFences(part2);
    return Response.json({ report: combined });
  } catch (error) {
    console.error('generateLraReport error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
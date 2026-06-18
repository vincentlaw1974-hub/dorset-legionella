import React, { useState, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { fileToDataUrl, uploadToCdn } from '@/lib/photoUpload';

const BRAND_RED   = '#C0392B';
const BRAND_DARK  = '#2C3E50';

const COMPANY = {
  name:       'Dorset Plumbing Ltd',
  address:    'Bayside Business Centre, 48 Willis Way, Poole, BH15 3TB',
  tel:        '01202 668822',
  email:      'info@dorsetplumbing.com',
  web:        'www.dorsetplumbing.com',
  gasSafe:    '943146',
  companyReg: '14237190',
  vat:        '429486262',
  tradingAs:  'Dorset Legionella Ltd',
  tradingWeb: 'www.dorsetlegionella.co.uk',
  tradingTel: '01202 270013',
};

const CERT = {
  company:   'Cert-ain Certification Ltd',
  certNo:    '95252/39577/58',
  validTo:   '13/06/2030',
  assessor:  'Benjamin White',
};

const RISK_STYLES = {
  HIGH:   { bg: '#C0392B', fg: '#FFFFFF', label: 'HIGH RISK'   },
  MEDIUM: { bg: '#E67E22', fg: '#FFFFFF', label: 'MEDIUM RISK' },
  LOW:    { bg: '#27AE60', fg: '#FFFFFF', label: 'LOW RISK'    },
};

async function resizeAndUpload(file) {
  const dataUrl = await fileToDataUrl(file);
  const resized = await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1200;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.70));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
  const blob = await (await fetch(resized)).blob();
  const cdnUrl = await uploadToCdn(new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
  return { dataUrl: resized, cdnUrl };
}

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

export default function AiDirectReportTab({ job }) {
  const [photos,   setPhotos]   = useState([]);
  const [notes,    setNotes]    = useState('');
  const [status,   setStatus]   = useState('');
  const [report,   setReport]   = useState('');
  const [loading,  setLoading]  = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef(null);

  const handleFiles = useCallback(async (files) => {
    const arr = Array.from(files);
    setStatus(`Processing ${arr.length} photo(s)…`);
    const processed = [];
    for (let i = 0; i < arr.length; i++) {
      setProgress(Math.round(((i + 1) / arr.length) * 50));
      setStatus(`Resizing photo ${i + 1} of ${arr.length}…`);
      try {
        const result = await resizeAndUpload(arr[i]);
        processed.push({ file: arr[i], ...result, caption: '', isCover: false });
      } catch (e) {
        console.warn('Photo failed:', arr[i].name, e);
      }
    }
    setPhotos(prev => [...prev, ...processed]);
    setStatus(`${processed.length} photo(s) ready.`);
    setProgress(0);
  }, []);

  const onFileChange = (e) => handleFiles(e.target.files);
  const onDrop = useCallback((e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }, [handleFiles]);
  const onDragOver = (e) => e.preventDefault();
  const removePhoto = (idx) => setPhotos(prev => prev.filter((_, i) => i !== idx));
  const updateCaption = (idx, val) => setPhotos(prev => prev.map((p, i) => i === idx ? { ...p, caption: val } : p));
  const setCover = (idx) => setPhotos(prev => prev.map((p, i) => ({ ...p, isCover: i === idx })));

  const generate = async () => {
    if (!job) { setStatus('No job loaded.'); return; }
    setLoading(true);
    setReport('');
    setProgress(5);

    try {
      const siteName = job.site_name || job.client || 'Site';
      const address  = job.address || '';
      const type     = job.property_type || 'Commercial';
      const date     = job.assessment_date || new Date().toISOString().slice(0, 10);
      const assessor = job.assessor || CERT.assessor;
      const rp       = job.responsible_person || '';
      const dh       = job.duty_holder || rp;

      const combined = `${type} ${siteName} ${notes || ''}`.toLowerCase();
      const isClinical  = /aesthetic|clinic|dental|botox|filler|injectable|needle|medical|gp|surgery|practice/.test(combined);
      const hasChildren = /child|nursery|playgroup|school|eyfs|ofsted|kids|toddler/.test(combined);
      const clinicalNote = isClinical ? `\n\nCLINICAL SITE: Apply ELEVATED susceptibility scoring (BS 8580-1:2019 Table 3). Hot outlets ≥50°C within 60s (HTM 04-01). Flag any procedure water as MEDIUM/HIGH risk. Recommend point-of-use filters on clinical wash basins.` : '';
      const childrenNote = hasChildren ? `\n\nCHILDREN'S FACILITY: TMVs mandatory on all child-accessible outlets (max 41°C). Apply ELEVATED susceptibility scoring. Flag unprotected outlets as HIGH priority.` : '';

      // Step 1: If there are photos, analyse them individually (in batches for API efficiency)
      // to extract specific, identified observations — never trust filenames, never generalise.
      const fileUrls = photos.filter(p => p.cdnUrl).map(p => p.cdnUrl);
      let photoObservations = '';

      if (fileUrls.length > 0) {
        const BATCH = 6; // smaller batches = more attention per photo
        const photoMeta = photos.filter(p => p.cdnUrl);
        const batches = [];
        for (let i = 0; i < photoMeta.length; i += BATCH) batches.push(photoMeta.slice(i, i + BATCH));

        setStatus(`Inspecting ${fileUrls.length} photos in detail (${batches.length} batch${batches.length > 1 ? 'es' : ''})…`);

        const batchPrompt = (batchItems, batchIdx, startNum) =>
          `You are a senior Legionella risk assessor visually inspecting site photographs from ${siteName} (${type}) for a chargeable compliance report. This is batch ${batchIdx+1} of ${batches.length}.

CRITICAL RULES:
- You are looking at ${batchItems.length} real photographs. Examine EACH one individually and in detail before writing anything.
- NEVER assume what a photo shows from its filename or position in the sequence — only describe what is visually present in the image itself.
- If the person has provided a caption, treat it as a hint only — verify it against what you actually see, and flag if it appears wrong.
- Identify SPECIFIC details wherever visible: manufacturer/brand names and model numbers printed on equipment, tap/fitting types (monobloc mixer, separate pillar taps, TMV, pillar tap with lever), visible temperature gauge readings, condition of scale/corrosion/sediment, presence of warning labels or signage, anything held/draped over taps, bin placement, overflow staining, insulation condition, tank lids, pipe lagging condition, and any text legible on stickers, plates, or signage.
- Distinguish precisely between similar-looking fixtures (e.g. a hose union tap is NOT a sink tap; a CWST is NOT a calorifier).
- Do not pad with generic boilerplate ("the photo shows a tap in a bathroom setting") — report only what is distinctive, specific and risk-relevant.

${batchItems.map((p, i) => `Photo ${startNum + i}${p.caption ? ` (person's caption: "${p.caption}")` : ''}`).join('\n')}

For EACH photo above, in order, write:
Photo [number]: [one specific sentence on what it actually shows — fixture type, location context if inferable] — [risk-relevant observations: brand/model if visible, condition, temperature if shown, defects, hygiene concerns, anything atypical]

Plain text only, no HTML, no headers — just the numbered list.`;

        let runningNum = 1;
        const batchResults = await Promise.all(
          batches.map((batchItems, idx) => {
            const startNum = runningNum;
            runningNum += batchItems.length;
            setProgress(5 + Math.round(((idx + 1) / batches.length) * 30));
            const batchUrls = batchItems.map(p => p.cdnUrl);
            return base44.integrations.Core.InvokeLLM({ prompt: batchPrompt(batchItems, idx, startNum), file_urls: batchUrls, model: 'claude_sonnet_4_6' });
          })
        );

        photoObservations = batchResults.map((r) => (typeof r === 'string' ? r : JSON.stringify(r))).join('\n');
        setProgress(40);
      }

      // Step 2: Build full context (text only — no images sent to report passes)
      const notesBlock = notes?.trim() ? `\n\nENGINEER NOTES:\n${notes.trim()}` : '';
      const photoBlock = photoObservations ? `\n\nPHOTO OBSERVATIONS (extracted from ${fileUrls.length} site photos):\n${photoObservations}` : '';

      const baseContext = `You are a senior Legionella risk assessor for ${COMPANY.tradingAs} (${COMPANY.name}, Gas Safe ${COMPANY.gasSafe}, Reg ${COMPANY.companyReg}, VAT ${COMPANY.vat}). Qualification: ${CERT.company}, Cert ${CERT.certNo}, valid ${CERT.validTo}.
Site: ${siteName} | Address: ${address} | Type: ${type} | Date: ${date} | Assessor: ${assessor} | RP: ${rp || 'Not recorded'} | Duty Holder: ${dh || 'Not recorded'}${notesBlock}${photoBlock}${clinicalNote}${childrenNote}
Regulatory refs: ACOP L8 (2013), HSG274 Parts 1-3, BS 8580-1:2019, COSHH 2002, HSWA 1974, MHSWR 1999, Water Fittings Regs 1999.

EVIDENCE RULES — these are not optional:
- The numbered photo observations above are direct visual evidence from the site visit. Use them as PRIMARY data, on equal footing with engineer notes. Reference specific brands, models, and conditions identified in them directly in your findings and asset register — do not generalise away detail that was actually observed.
- If a specific photo observation identifies a manufacturer, model, fault, or reading, that fact MUST appear in the relevant section (asset register, findings, or risk table) — do not silently drop it.
- Only write "not recorded", "not confirmed", or "not observed" when there is genuinely no photo, note, or job-field evidence covering that point. Do not hedge on points where evidence was provided.
- Engineer notes always override photo interpretation where they conflict.

Output clean HTML only (h1,h2,h3,table,ul,li,p). Headings #C0392B, body #2C3E50, HIGH=bg #C0392B white, MEDIUM=bg #E67E22 white, LOW=bg #27AE60 white. No placeholder text — state if data missing.`;

      const pass1Prompt = `${baseContext}\n\nProduce sections 1–5 ONLY:\n1. EXECUTIVE SUMMARY (3-4 sentences)\n2. MANDATORY LEGAL STATEMENT (verbatim): "This risk assessment has been carried out in accordance with BS 8580-1:2019, the HSE Approved Code of Practice L8 (4th Edition), and associated HSG274 guidance. It reflects conditions observed at the time of inspection on ${date} and should not be regarded as a guarantee of conditions at any other time. This document does not constitute legal advice. ${COMPANY.tradingAs} / ${COMPANY.name} accepts no liability for incidents arising from changes to the water system, occupancy, or use patterns after the date of this assessment. The duty holder is reminded that ACOP L8 places a continuing legal obligation to manage Legionella risk and this document should be reviewed whenever significant changes occur, and in any event at least every two years (or annually for high-risk premises)."\n3. SCOPE & LIMITATIONS (bullets)\n4. PROPERTY DESCRIPTION\n5. WATER SYSTEM INVENTORY TABLE (cols: Ref|Asset|Location|Normal Temp|Last Serviced|Condition|Notes; prefixes HW-/CW-/TM-/SH-)`;

      const pass2Prompt = `${baseContext}\n\nProduce sections 6–10 ONLY:\n6. TEMPERATURE DATA\n7. RISK ASSESSMENT TABLE (cols: Ref|Description|Location|Likelihood 1-5|Severity 1-5|Score|Risk Level|Action|Priority)\n8. PRIORITISED ACTION PLAN TABLE (cols: Priority|Ref|Action|Responsible|Target Date)\n9. ONGOING MONITORING PROGRAMME (monthly/quarterly/annual)\n10. ASSESSOR DECLARATION: "This assessment was carried out by ${assessor} on behalf of ${COMPANY.tradingAs} / ${COMPANY.name} on ${date}. The assessor holds a current Legionella risk assessment qualification (${CERT.company}, Cert No. ${CERT.certNo}, valid to ${CERT.validTo}). The findings and recommendations are based solely on conditions observed at the time of the site visit."`;

      setStatus('Writing report sections — please wait…');
      setProgress(50);

      const [p1, p2] = await Promise.all([
        base44.integrations.Core.InvokeLLM({ prompt: pass1Prompt, model: 'claude_sonnet_4_6' }),
        base44.integrations.Core.InvokeLLM({ prompt: pass2Prompt, model: 'claude_sonnet_4_6' }),
      ]);

      setProgress(95);
      const strip = (s) => (typeof s === 'string' ? s : JSON.stringify(s)).replace(/^```(?:html)?\s*/i, '').replace(/\s*```\s*$/i, '');
      setReport(strip(p1) + strip(p2));
      setStatus('Report generated successfully.');
      setProgress(100);
    } catch (e) {
      setStatus(`Error: ${e.message}`);
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const buildSchematicSvg = () => {
    const w = 680, h = 320;
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" style="font-family:Arial,sans-serif;font-size:11px;">
      <defs>
        <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#2C3E50"/>
        </marker>
      </defs>
      <rect width="${w}" height="${h}" fill="#f9f9f9" rx="6" stroke="#ddd"/>
      <text x="10" y="20" font-weight="bold" fill="#C0392B" font-size="13">Water System Schematic — ${(job?.site_name||'Site').replace(/</g,'&lt;')}</text>
      <rect x="20" y="50" width="90" height="40" fill="#3498DB" rx="4"/>
      <text x="65" y="67" text-anchor="middle" fill="white" font-weight="bold">MAINS</text>
      <text x="65" y="82" text-anchor="middle" fill="white">WATER</text>
      <line x1="110" y1="70" x2="170" y2="70" stroke="#2C3E50" stroke-width="2" marker-end="url(#arr)"/>
      <rect x="170" y="40" width="100" height="60" fill="#85C1E9" rx="4" stroke="#2C3E50" stroke-width="1.5"/>
      <text x="220" y="62" text-anchor="middle" fill="#1A5276" font-weight="bold">CW STORAGE</text>
      <text x="220" y="77" text-anchor="middle" fill="#1A5276">TANK</text>
      <text x="220" y="92" text-anchor="middle" fill="#1A5276" font-size="9">≤20°C target</text>
      <line x1="270" y1="70" x2="330" y2="70" stroke="#2C3E50" stroke-width="2" marker-end="url(#arr)"/>
      <rect x="330" y="35" width="110" height="70" fill="#E8DAEF" rx="4" stroke="#7D3C98" stroke-width="1.5"/>
      <text x="385" y="57" text-anchor="middle" fill="#6C3483" font-weight="bold">CALORIFIER /</text>
      <text x="385" y="72" text-anchor="middle" fill="#6C3483" font-weight="bold">HOT WATER</text>
      <text x="385" y="87" text-anchor="middle" fill="#6C3483" font-size="9">≥60°C store</text>
      <text x="385" y="99" text-anchor="middle" fill="#6C3483" font-size="9">≥50°C flow</text>
      <line x1="440" y1="70" x2="520" y2="70" stroke="#E74C3C" stroke-width="2" marker-end="url(#arr)"/>
      <text x="480" y="63" text-anchor="middle" fill="#E74C3C" font-size="9">HW ≥50°C</text>
      <rect x="520" y="40" width="140" height="35" fill="#FADBD8" rx="4" stroke="#C0392B" stroke-width="1.5"/>
      <text x="590" y="55" text-anchor="middle" fill="#922B21" font-weight="bold">HOT OUTLETS</text>
      <text x="590" y="68" text-anchor="middle" fill="#922B21" font-size="9">WHBs · Showers · Baths</text>
      <line x1="220" y1="100" x2="220" y2="150" stroke="#2980B9" stroke-width="2" marker-end="url(#arr)"/>
      <line x1="220" y1="150" x2="520" y2="150" stroke="#2980B9" stroke-width="2" marker-end="url(#arr)"/>
      <text x="370" y="143" text-anchor="middle" fill="#2980B9" font-size="9">CW ≤20°C</text>
      <rect x="520" y="130" width="140" height="35" fill="#D6EAF8" rx="4" stroke="#2980B9" stroke-width="1.5"/>
      <text x="590" y="145" text-anchor="middle" fill="#154360" font-weight="bold">COLD OUTLETS</text>
      <text x="590" y="158" text-anchor="middle" fill="#154360" font-size="9">WHBs · Drinking · Kitchen</text>
      <line x1="520" y1="57" x2="520" y2="147" stroke="#8E44AD" stroke-width="1.5" stroke-dasharray="5,3"/>
      <rect x="495" y="95" width="50" height="22" fill="#E8DAEF" rx="3" stroke="#8E44AD"/>
      <text x="520" y="110" text-anchor="middle" fill="#6C3483" font-weight="bold" font-size="10">TMV</text>
      <line x1="440" y1="85" x2="440" y2="200" stroke="#E74C3C" stroke-width="1.5" stroke-dasharray="5,3"/>
      <line x1="440" y1="200" x2="385" y2="200" stroke="#E74C3C" stroke-width="1.5" marker-end="url(#arr)"/>
      <line x1="385" y1="200" x2="385" y2="105" stroke="#E74C3C" stroke-width="1.5"/>
      <text x="412" y="215" text-anchor="middle" fill="#E74C3C" font-size="9">HW return ≥50°C</text>
      <rect x="20" y="240" width="640" height="70" fill="white" rx="4" stroke="#ddd"/>
      <text x="30" y="258" font-weight="bold" fill="#2C3E50">Legend:</text>
      <rect x="30" y="265" width="14" height="8" fill="#E74C3C"/>
      <text x="50" y="274" fill="#2C3E50">Hot water (≥50°C)</text>
      <rect x="170" y="265" width="14" height="8" fill="#2980B9"/>
      <text x="190" y="274" fill="#2C3E50">Cold water (≤20°C)</text>
      <line x1="330" y1="269" x2="344" y2="269" stroke="#8E44AD" stroke-width="2" stroke-dasharray="4,2"/>
      <text x="350" y="274" fill="#2C3E50">TMV blended supply</text>
      <line x1="490" y1="269" x2="504" y2="269" stroke="#E74C3C" stroke-width="2" stroke-dasharray="4,2"/>
      <text x="510" y="274" fill="#2C3E50">HW return/circulation</text>
      <text x="30" y="298" fill="#666" font-size="9">Note: This schematic is indicative only, based on site observations. Full system survey may reveal additional components.</text>
    </svg>`;
  };

  const buildPhotoGrid = () => {
    if (!photos.length) return '';
    const photoHtml = photos.map((p, i) => {
      const src = p.cdnUrl || p.dataUrl;
      if (!src) return '';
      return `<div style="display:inline-block;width:30%;margin:1%;vertical-align:top;page-break-inside:avoid;">
        <img src="${src}" style="width:100%;height:160px;object-fit:cover;border-radius:4px;border:1px solid #ddd;" />
        <div style="font-size:9pt;color:#555;margin-top:4px;text-align:center;">${p.caption || `Photo ${i+1}`}</div>
      </div>`;
    }).join('');
    return `<div style="margin-top:8px;">${photoHtml}</div>`;
  };

  const printReport = () => {
    const coverChoice = photos.find(p => p.isCover) || photos[0];
    const coverPhoto = coverChoice?.cdnUrl || coverChoice?.dataUrl || '';
    const riskStyle = RISK_STYLES[(job?.risk_level || '').toUpperCase()] || { bg: '#95A5A6', fg: '#fff', label: job?.risk_level || 'NOT SET' };
    const siteName = job?.site_name || job?.client || 'Site';
    const date = job?.assessment_date || new Date().toISOString().slice(0, 10);

    const coverPage = `
<div style="page-break-after:always;height:100vh;display:flex;flex-direction:column;background:#fff;">
  <div style="background:#C0392B;color:white;padding:20px 30px;display:flex;align-items:center;justify-content:space-between;">
    <div>
      <div style="font-size:22pt;font-weight:bold;letter-spacing:1px;">${COMPANY.tradingAs}</div>
      <div style="font-size:10pt;opacity:0.85;margin-top:2px;">${COMPANY.name} &nbsp;·&nbsp; Gas Safe No. ${COMPANY.gasSafe} &nbsp;·&nbsp; Reg. ${COMPANY.companyReg}</div>
    </div>
    <div style="text-align:right;font-size:9pt;opacity:0.85;">
      <div>${COMPANY.tradingTel}</div>
      <div>${COMPANY.tradingWeb}</div>
      <div>${COMPANY.email}</div>
    </div>
  </div>
  ${coverPhoto ? `<div style="flex:1;overflow:hidden;max-height:340px;">
    <img src="${coverPhoto}" style="width:100%;height:340px;object-fit:cover;" />
  </div>` : `<div style="flex:1;background:linear-gradient(135deg,#2C3E50 0%,#C0392B 100%);max-height:340px;display:flex;align-items:center;justify-content:center;">
    <div style="font-size:48pt;opacity:0.3;">💧</div>
  </div>`}
  <div style="padding:24px 30px;border-top:4px solid #C0392B;">
    <div style="font-size:8pt;color:#C0392B;font-weight:bold;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">Legionella Risk Assessment Report</div>
    <div style="font-size:22pt;font-weight:bold;color:#2C3E50;">${siteName}</div>
    ${job?.address ? `<div style="font-size:11pt;color:#666;margin-top:4px;">${job.address}</div>` : ''}
    <div style="margin-top:16px;display:flex;gap:24px;flex-wrap:wrap;">
      <div><span style="font-size:8pt;color:#999;text-transform:uppercase;">Property Type</span><br/><strong style="color:#2C3E50;">${job?.property_type || '—'}</strong></div>
      <div><span style="font-size:8pt;color:#999;text-transform:uppercase;">Assessment Date</span><br/><strong style="color:#2C3E50;">${date}</strong></div>
      <div><span style="font-size:8pt;color:#999;text-transform:uppercase;">Assessor</span><br/><strong style="color:#2C3E50;">${job?.assessor || CERT.assessor}</strong></div>
      <div><span style="font-size:8pt;color:#999;text-transform:uppercase;">Overall Risk</span><br/><strong style="background:${riskStyle.bg};color:${riskStyle.fg};padding:2px 12px;border-radius:3px;">${riskStyle.label}</strong></div>
      <div><span style="font-size:8pt;color:#999;text-transform:uppercase;">Report Ref</span><br/><strong style="color:#2C3E50;">${job?.report_ref || 'See report'}</strong></div>
    </div>
  </div>
  <div style="background:#2C3E50;color:white;padding:10px 30px;font-size:8pt;display:flex;justify-content:space-between;align-items:center;">
    <div>Qualification: ${CERT.company} &nbsp;·&nbsp; Cert No. ${CERT.certNo} &nbsp;·&nbsp; Valid to ${CERT.validTo}</div>
    <div>CONFIDENTIAL — For the attention of the Duty Holder only</div>
  </div>
</div>`;

    const schematic = `
<div style="page-break-inside:avoid;margin:20px 0;">
  <h2 style="color:#C0392B;font-size:13pt;border-bottom:1px solid #C0392B;padding-bottom:4px;">Water System Schematic</h2>
  ${buildSchematicSvg()}
</div>`;

    const photosSection = photos.length > 0 ? `
<div style="page-break-before:always;">
  <h2 style="color:#C0392B;font-size:13pt;border-bottom:1px solid #C0392B;padding-bottom:4px;">Site Photographs</h2>
  <p style="font-size:9pt;color:#666;">The following photographs were taken during the site visit on ${date} and form part of this risk assessment.</p>
  ${buildPhotoGrid()}
</div>` : '';

    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head>
<meta charset="utf-8">
<title>Legionella Risk Assessment — ${siteName}</title>
<style>
  @page { margin: 15mm 12mm 20mm 12mm; }
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #2C3E50; line-height: 1.5; margin: 0; }
  h1 { color: #C0392B; font-size: 16pt; border-bottom: 2px solid #C0392B; padding-bottom: 4px; }
  h2 { color: #C0392B; font-size: 13pt; margin-top: 18px; }
  h3 { color: #2C3E50; font-size: 11pt; margin-top: 12px; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 10pt; }
  th { background: #C0392B; color: #fff; padding: 6px 8px; text-align: left; }
  td { border: 1px solid #ccc; padding: 5px 8px; vertical-align: top; }
  tr:nth-child(even) td { background: #f7f7f7; }
  .page-footer { position: fixed; bottom: 0; left: 0; right: 0; font-size: 8pt; color: #666; border-top: 1px solid #ccc; padding: 4px 12px; text-align: center; background: white; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head><body>
${coverPage}
<div style="padding: 0 4mm;">
<div class="page-footer">${COMPANY.tradingAs} &nbsp;|&nbsp; Gas Safe No. ${COMPANY.gasSafe} &nbsp;|&nbsp; Reg. ${COMPANY.companyReg} &nbsp;|&nbsp; VAT ${COMPANY.vat} &nbsp;|&nbsp; ${COMPANY.tradingTel} &nbsp;|&nbsp; ${COMPANY.tradingWeb}</div>
${schematic}
${report}
${photosSection}
</div>
</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 800);
  };

  const riskColour = (level) => RISK_STYLES[(level || '').toUpperCase()] || { bg: '#95A5A6', fg: '#fff', label: level || '—' };

  return (
    <div style={{ padding: '16px', fontFamily: 'Arial, sans-serif', color: BRAND_DARK }}>
      <div style={{ marginBottom: '16px', borderBottom: `3px solid ${BRAND_RED}`, paddingBottom: '10px' }}>
        <h2 style={{ margin: 0, color: BRAND_RED, fontSize: '18px' }}>AI Direct Report Generator</h2>
        <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#666' }}>{COMPANY.tradingAs} — ACOP L8 / BS 8580-1:2019 Compliant</p>
      </div>

      {job && (
        <div style={{ background: '#f4f4f4', borderLeft: `4px solid ${BRAND_RED}`, padding: '10px 14px', marginBottom: '14px', fontSize: '13px' }}>
          <strong>{job.site_name || job.client || 'Unnamed site'}</strong>
          {job.address && <span style={{ marginLeft: '10px', color: '#555' }}>{job.address}</span>}
          {job.property_type && <span style={{ marginLeft: '10px', background: BRAND_DARK, color: '#fff', padding: '1px 8px', borderRadius: '3px', fontSize: '11px' }}>{job.property_type}</span>}
          {job.risk_level && <span style={{ marginLeft: '8px', background: riskColour(job.risk_level).bg, color: riskColour(job.risk_level).fg, padding: '1px 8px', borderRadius: '3px', fontSize: '11px', fontWeight: 'bold' }}>{riskColour(job.risk_level).label}</span>}
        </div>
      )}

      <div
        onDrop={onDrop} onDragOver={onDragOver} onClick={() => fileRef.current?.click()}
        style={{ border: `2px dashed ${BRAND_RED}`, borderRadius: '6px', padding: '20px', textAlign: 'center', cursor: 'pointer', marginBottom: '14px', background: '#fdf9f9' }}
      >
        <div style={{ fontSize: '28px', marginBottom: '4px' }}>📷</div>
        <div style={{ fontSize: '13px', color: '#555' }}>Drag &amp; drop site photos here, or click to select</div>
        <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>JPG/PNG — resized to 1200px / 70% quality automatically</div>
        <input ref={fileRef} type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={onFileChange} />
      </div>

      {photos.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
          {photos.map((p, i) => (
            <div key={i} style={{ position: 'relative', width: '120px' }}>
              <img src={p.dataUrl} alt="" style={{ width: '120px', height: '90px', objectFit: 'cover', borderRadius: '4px', border: p.isCover ? `2px solid ${BRAND_RED}` : '1px solid #ddd' }} />
              <button onClick={() => removePhoto(i)} style={{ position: 'absolute', top: '2px', right: '2px', background: BRAND_RED, color: '#fff', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', fontSize: '11px', lineHeight: '20px', textAlign: 'center', padding: 0 }}>×</button>
              <button onClick={() => setCover(i)} title="Use as cover photo" style={{ position: 'absolute', top: '2px', left: '2px', background: p.isCover ? BRAND_RED : 'rgba(255,255,255,0.85)', color: p.isCover ? '#fff' : '#999', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', fontSize: '12px', lineHeight: '20px', textAlign: 'center', padding: 0 }}>★</button>
              <input value={p.caption} onChange={e => updateCaption(i, e.target.value)} placeholder="What is this actually? e.g. plant room cylinder" style={{ width: '100%', marginTop: '4px', fontSize: '11px', padding: '2px 4px', border: '1px solid #ccc', borderRadius: '3px', boxSizing: 'border-box' }} />
            </div>
          ))}
        </div>
      )}

      <div style={{ marginBottom: '14px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px', color: BRAND_DARK }}>Engineer Notes (Jake's site notes / WhatsApp message):</label>
        <textarea
          value={notes} onChange={e => setNotes(e.target.value)} rows={8}
          placeholder={`Site: [name], visited [date]\nResponsible person: [name / title]\nCold water tank: [location, condition, lid present Y/N]\nCalorifier / unvented cylinder: [make, model, T&P valve present, last service date]\nHot outlets tested: [locations, temps recorded]\nCold outlets tested: [locations, temps recorded]\nTMVs: [locations, set temps, last tested]\nShowers: [locations, condition, type of head, last descaled]\nDead legs: [any identified Y/N]\nAC units: [make/model, location, condition, last serviced]\nGeneral observations / anomalies:`}
          style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace', boxSizing: 'border-box', resize: 'vertical' }}
        />
      </div>

      <button onClick={generate} disabled={loading}
        style={{ background: loading ? '#ccc' : BRAND_RED, color: '#fff', border: 'none', padding: '12px 28px', borderRadius: '5px', fontSize: '14px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', width: '100%', marginBottom: '10px' }}>
        {loading ? 'Generating Report…' : '⚡ Generate Full Report with AI'}
      </button>

      {(loading || status) && (
        <div style={{ marginBottom: '12px' }}>
          {progress > 0 && (
            <div style={{ background: '#eee', borderRadius: '4px', height: '8px', marginBottom: '6px' }}>
              <div style={{ background: BRAND_RED, height: '8px', borderRadius: '4px', width: `${progress}%`, transition: 'width 0.3s' }} />
            </div>
          )}
          <div style={{ fontSize: '12px', color: '#555' }}>{status}</div>
        </div>
      )}

      {report && (
        <div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
            <button onClick={printReport}
              style={{ background: BRAND_DARK, color: '#fff', border: 'none', padding: '9px 20px', borderRadius: '5px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}>
              🖨️ Print / Save PDF
            </button>
          </div>
          <div style={{ border: '1px solid #ddd', borderRadius: '6px', padding: '20px', background: '#fff', fontSize: '12px', lineHeight: 1.6 }}
            dangerouslySetInnerHTML={{ __html: report }} />
        </div>
      )}
    </div>
  );
}
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { fileToDataUrl, uploadToCdn } from '@/lib/photoUpload';

const BRAND_RED  = '#C0392B';
const BRAND_DARK = '#2C3E50';

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
  company:  'Cert-ain Certification Ltd',
  certNo:   '95252/39577/58',
  validTo:  '13/06/2030',
  assessor: 'Benjamin White',
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

export default function AiDirectReportTab({ job, onChange }) {
  // Photos for THIS tab — separate from job.photos (those are the job's main photo register)
  const [photos,   setPhotos]   = useState([]);
  const [notes,    setNotes]    = useState('');
  const [report,   setReport]   = useState('');
  const [editing,  setEditing]  = useState(false); // toggle edit mode
  const [status,   setStatus]   = useState('');
  const [loading,  setLoading]  = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef(null);

  // Load saved report + notes + cover photo from job on mount / job change
  useEffect(() => {
    if (!job) return;
    if (job.ai_report_html) setReport(job.ai_report_html);
    if (job.ai_report_notes) setNotes(job.ai_report_notes);
    // Restore saved AI report photos (stored in job.ai_report_photos)
    if (job.ai_report_photos?.length) {
      setPhotos(job.ai_report_photos.map(p => ({
        dataUrl: p.url,
        cdnUrl:  p.url,
        caption: p.caption || '',
        isCover: p.isCover || false,
      })));
    }
  }, [job?.id]);

  // Save report HTML + notes back to job whenever they change
  const saveToJob = useCallback((html, notesVal, photosArr) => {
    if (!onChange) return;
    onChange({
      ai_report_html:   html,
      ai_report_notes:  notesVal,
      ai_report_photos: photosArr.map(p => ({
        url:     p.cdnUrl || p.dataUrl || '',
        caption: p.caption || '',
        isCover: p.isCover || false,
      })),
    });
  }, [onChange]);

  const handleFiles = useCallback(async (files) => {
    const arr = Array.from(files);
    setStatus(`Processing ${arr.length} photo(s)…`);
    const processed = [];
    for (let i = 0; i < arr.length; i++) {
      setProgress(Math.round(((i + 1) / arr.length) * 40));
      setStatus(`Uploading photo ${i + 1} of ${arr.length}…`);
      try {
        const result = await resizeAndUpload(arr[i]);
        processed.push({ file: arr[i], ...result, caption: '', isCover: false });
      } catch (e) {
        console.warn('Photo failed:', arr[i].name, e);
      }
    }
    setPhotos(prev => {
      const next = [...prev, ...processed];
      saveToJob(report, notes, next);
      return next;
    });
    setStatus(`${processed.length} photo(s) uploaded.`);
    setProgress(0);
  }, [report, notes, saveToJob]);

  const onFileChange  = (e) => handleFiles(e.target.files);
  const onDrop        = useCallback((e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }, [handleFiles]);
  const onDragOver    = (e) => e.preventDefault();

  const removePhoto = (idx) => setPhotos(prev => {
    const next = prev.filter((_, i) => i !== idx);
    saveToJob(report, notes, next);
    return next;
  });

  const updateCaption = (idx, val) => setPhotos(prev => {
    const next = prev.map((p, i) => i === idx ? { ...p, caption: val } : p);
    saveToJob(report, notes, next);
    return next;
  });

  const setCover = (idx) => setPhotos(prev => {
    const next = prev.map((p, i) => ({ ...p, isCover: i === idx }));
    saveToJob(report, notes, next);
    return next;
  });

  const handleNotesChange = (val) => {
    setNotes(val);
    saveToJob(report, val, photos);
  };

  const handleReportChange = (val) => {
    setReport(val);
    saveToJob(val, notes, photos);
  };

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

      const combined    = `${type} ${siteName} ${notes || ''}`.toLowerCase();
      const isClinical  = /aesthetic|clinic|dental|botox|filler|injectable|needle|medical|gp|surgery|practice/.test(combined);
      const hasChildren = /child|nursery|playgroup|school|eyfs|ofsted|kids|toddler/.test(combined);
      const clinicalNote = isClinical ? `\n\nCLINICAL SITE: Apply ELEVATED susceptibility scoring (BS 8580-1:2019 Table 3). Hot outlets ≥50°C within 60s. Flag procedure water as MEDIUM/HIGH risk. Recommend point-of-use filters on clinical wash basins.` : '';
      const childrenNote = hasChildren ? `\n\nCHILDREN'S FACILITY: TMVs mandatory on all child-accessible outlets (max 41°C). Apply ELEVATED susceptibility scoring.` : '';

      // Step 1: Photo analysis — batches of 6
      const fileUrls = photos.filter(p => p.cdnUrl).map(p => p.cdnUrl);
      let photoObservations = '';

      if (fileUrls.length > 0) {
        const BATCH = 6;
        const photoMeta = photos.filter(p => p.cdnUrl);
        const batches = [];
        for (let i = 0; i < photoMeta.length; i += BATCH) batches.push(photoMeta.slice(i, i + BATCH));

        setStatus(`Inspecting ${fileUrls.length} photos in ${batches.length} batch${batches.length > 1 ? 'es' : ''}…`);

        const batchPrompt = (batchItems, batchIdx, startNum) =>
          `You are a senior Legionella risk assessor visually inspecting site photographs from ${siteName} (${type}) for a chargeable compliance report. Batch ${batchIdx+1} of ${batches.length}.
Examine each photo individually. Identify: fixture types, brand/model names, temperature gauge readings, TMV locations, shower scale, tank conditions, pipework defects, labels, warning signs.
${batchItems.map((p, i) => `Photo ${startNum + i}${p.caption ? ` (caption: "${p.caption}")` : ''}`).join('\n')}
For each photo write: Photo [N]: [what it shows] — [risk-relevant observations]
Plain text only.`;

        let runningNum = 1;
        const batchResults = await Promise.all(
          batches.map((batchItems, idx) => {
            const startNum = runningNum;
            runningNum += batchItems.length;
            setProgress(5 + Math.round(((idx + 1) / batches.length) * 30));
            return base44.integrations.Core.InvokeLLM({
              prompt: batchPrompt(batchItems, idx, startNum),
              file_urls: batchItems.map(p => p.cdnUrl),
              model: 'claude_sonnet_4_6'
            });
          })
        );

        photoObservations = batchResults.map(r => (typeof r === 'string' ? r : JSON.stringify(r))).join('\n');
        setProgress(40);
      }

      // Step 2: Build text context for report passes
      const notesBlock = notes?.trim() ? `\n\nENGINEER NOTES:\n${notes.trim()}` : '';
      const photoBlock  = photoObservations ? `\n\nPHOTO OBSERVATIONS (from ${fileUrls.length} photos):\n${photoObservations}` : '';

      // Build structured job data block — this is what Claude uses to write a detailed, evidence-based report
      const allOutlets = [
        ...(job.outlets || []),
        ...(job.buildings || []).flatMap(b => (b.outlets || []).map(o => ({ ...o, building: b.name || b.site_name || '' })))
      ];
      const failOutlets = allOutlets.filter(o => {
        const hot = parseFloat(o.hot);
        const cold = parseFloat(o.cold);
        return (!isNaN(hot) && hot < 50) || (!isNaN(cold) && cold > 20);
      });

      const tmvs = job.tmvs || [];
      const showers = job.showers || [];
      const deadLegs = job.dead_legs || [];
      const actions = job.actions || [];
      const issues = job.issues_text || job.issues || '';

      const outletTable = allOutlets.length > 0
        ? allOutlets.map((o, i) => `  ${i+1}. ${o.type || 'Outlet'} at ${o.location || 'unknown'}${o.building ? ` (${o.building})` : ''} — Hot: ${o.hot || 'N/A'}°C, Cold: ${o.cold || 'N/A'}°C${o.hasTmv ? ', TMV fitted' : ''}${o.infrequent ? ', infrequent use' : ''}${o.notes ? `, notes: ${o.notes}` : ''}`).join('\n')
        : '  None recorded.';
      const tmvList = tmvs.length > 0
        ? tmvs.map((t, i) => `  ${i+1}. ${t.location || 'Unknown'} — ${t.type || 'TMV'}, set temp: ${t.set_temp || t.temperature || 'N/A'}°C, last tested: ${t.last_tested || t.last_serviced || 'N/A'}, condition: ${t.condition || 'N/A'}`).join('\n')
        : '  None recorded.';
      const showerList = showers.length > 0
        ? showers.map((s, i) => `  ${i+1}. ${s.location || 'Unknown'} — condition: ${s.condition || 'N/A'}, last descaled: ${s.last_descaled || s.descale_date || 'N/A'}${s.notes ? `, notes: ${s.notes}` : ''}`).join('\n')
        : '  None recorded.';
      const deadLegList = deadLegs.length > 0
        ? deadLegs.map((d, i) => `  ${i+1}. ${d.location || 'Unknown'} — ${d.description || 'Dead leg identified'}${d.pipe_material ? `, pipe: ${d.pipe_material}` : ''}`).join('\n')
        : '  None identified.';
      const actionList = actions.length > 0
        ? actions.map((a, i) => `  ${a.ref || `A${i+1}`} [${a.priority || 'med'} priority] ${a.action || a.title || ''} — ${a.system || ''} ${a.observation || ''} (responsible: ${a.responsible_person || 'TBC'}, deadline: ${a.deadline || 'TBC'}, status: ${a.status || 'Open'})`).join('\n')
        : '  None recorded.';

      const structuredData = `\n\nSTRUCTURED SITE DATA (already captured during assessment — use as PRIMARY evidence alongside photos and notes):

WATER SYSTEMS:
- Cold water source: ${job.cold_source || 'Mains'}
- Hot water system: ${job.hw_not_stored ? 'Combi / instantaneous (no stored HW)' : `Stored HW — cylinder/calorifier temp: ${job.cylinder_temp || 'not recorded'}°C`}
- CWST (cold water storage tank): ${job.cwst_present ? `Present — location: ${job.cwst_location || 'unknown'}, condition: ${job.cwst_condition || 'not recorded'}` : 'Not present / not identified'}
- TMVs installed on site: ${job.tmvs_installed ? 'Yes' : 'No / not confirmed'}
- Written scheme in place: ${job.written_scheme ? 'Yes' : 'No / not confirmed'}

OUTLET TEMPERATURE READINGS (${allOutlets.length} total, ${failOutlets.length} failing criteria — HOT must be ≥50°C within 1 min, COLD must be ≤20°C):
${outletTable}

TMV REGISTER (${tmvs.length}):
${tmvList}

SHOWER REGISTER (${showers.length}):
${showerList}

DEAD LEGS / STAGNATION RISKS (${deadLegs.length}):
${deadLegList}

EXISTING ACTIONS / RECOMMENDATIONS (${actions.length}):
${actionList}

ISSUES IDENTIFIED:
${issues || '  None specifically recorded.'}

SUSCEPTIBILITY & COMPLIANCE:
- Vulnerable users on site: ${job.vulnerable_users ? 'Yes' : 'No / not confirmed'}
- CQC / care mode: ${job.cqc_mode ? 'Yes — stricter thresholds apply (HOT ≥55°C, COLD ≤20°C)' : 'No — standard thresholds (HOT ≥50°C, COLD ≤20°C)'}
- Water samples taken: ${job.water_samples_taken ? `Yes — result: ${job.water_samples_results || 'pending'}` : 'No'}
- Recommended reassessment interval: ${job.reassessment_interval || '24'} months
- Overall calculated risk level: ${job.risk || job.risk_level || 'Not calculated'}
`;

      const baseContext = `You are a senior Legionella risk assessor for ${COMPANY.tradingAs} (${COMPANY.name}, Gas Safe ${COMPANY.gasSafe}, Reg ${COMPANY.companyReg}, VAT ${COMPANY.vat}). Qualification: ${CERT.company}, Cert ${CERT.certNo}, valid ${CERT.validTo}.
Site: ${siteName} | Address: ${address} | Type: ${type} | Date: ${date} | Assessor: ${assessor} | RP: ${rp || 'Not recorded'} | Duty Holder: ${dh || 'Not recorded'}${notesBlock}${photoBlock}${structuredData}${clinicalNote}${childrenNote}
Regulatory refs: ACOP L8 (2013), HSG274 Parts 1-3, BS 8580-1:2019, COSHH 2002, HSWA 1974, MHSWR 1999, Water Fittings Regs 1999.
You have THREE sources of evidence: (1) STRUCTURED SITE DATA above — outlet temperatures, system details, TMV/shower/dead leg registers, existing actions; (2) PHOTO OBSERVATIONS; (3) ENGINEER NOTES. Use ALL of them. Reference specific readings, locations, and observations in your findings. Do NOT invent readings — if data is missing, state this clearly and recommend the duty holder provides it.
Output clean HTML only (h1,h2,h3,table,ul,li,p). Headings #C0392B, body #2C3E50, HIGH=bg #C0392B white, MEDIUM=bg #E67E22 white, LOW=bg #27AE60 white.`;

      const legalStatement = `"This risk assessment has been carried out in accordance with BS 8580-1:2019, the HSE Approved Code of Practice L8 (4th Edition), and associated HSG274 guidance. It reflects conditions observed at the time of inspection on ${date} and should not be regarded as a guarantee of conditions at any other time. This document does not constitute legal advice. ${COMPANY.tradingAs} / ${COMPANY.name} accepts no liability for incidents arising from changes to the water system, occupancy, or use patterns after the date of this assessment. The duty holder is reminded that ACOP L8 places a continuing legal obligation to manage Legionella risk and this document should be reviewed whenever significant changes occur, and in any event at least every two years (or annually for high-risk premises)."`;

      const pass1Prompt = `${baseContext}\n\nOutput Sections 1–3 ONLY. Be thorough and detailed — this is a chargeable compliance document.\n1. EXECUTIVE SUMMARY (4-6 sentences: what was inspected, overall risk level with justification, key findings, immediate actions required, any significant data gaps)\n2. MANDATORY LEGAL STATEMENT (reproduce verbatim, do not alter): ${legalStatement}\n3. SCOPE & LIMITATIONS (detailed bullet list: what was inspected, what was not inspected, access restrictions, items that could not be verified, reliance on third-party data)`;

      const pass2Prompt = `${baseContext}\n\nOutput Sections 4–5 ONLY. Be thorough and detailed.\n4. PROPERTY DESCRIPTION (building overview: construction, floors, approximate age, occupancy profile, hours of use, water system architecture, incoming supply, distribution layout)\n5. WATER SYSTEM INVENTORY / ASSET REGISTER — full HTML table with columns: Ref | Asset Description | Location | Normal Operating Temp | Last Serviced | Condition | Notes. Use prefixes HW- (hot water), CW- (cold water), AC- (air conditioning), TM- (TMVs), SH- (showers), OH- (other hot outlets), OC- (other cold outlets). List every asset identified from notes and photos.`;

      const pass3Prompt = `${baseContext}\n\nOutput Sections 6–8 ONLY. Be thorough and detailed — this is the core risk assessment.\n6. TEMPERATURE DATA — Use the OUTLET TEMPERATURE READINGS from the STRUCTURED SITE DATA above as your primary source. Build a full HTML table of every outlet with its hot/cold readings and pass/fail status against the applicable thresholds (HOT ≥50°C or ≥55°C in care/CQC mode; COLD ≤20°C). If no readings were taken, state this and recommend the duty holder provides records. Also include any system temperatures noted (cylinder, CWST, etc.).\n7. RISK ASSESSMENT — BS 8580-1:2019 SCORING — full HTML table: Finding Ref | Description | Location | Likelihood (1–5) | Severity (1–5) | Risk Score | Risk Level (LOW/MEDIUM/HIGH) | Recommended Action | Priority. Score EVERY finding from the structured data: each failing outlet, each dead leg, each shower in poor condition, each missing control measure, system temperature non-compliance, stagnation risks, etc. Apply ELEVATED susceptibility scoring for healthcare, care homes, children's facilities, clinical sites. Reference specific readings, locations, and photo observations as evidence for each finding.\n8. PRIORITISED ACTION PLAN — full HTML table: Priority | Ref | Action | Responsible Party | Target Date. Order by priority (1 = highest). Incorporate the EXISTING ACTIONS from the structured data, plus any new actions identified during this assessment. Be specific about remedial actions.`;

      const pass4Prompt = `${baseContext}\n\nOutput Sections 9–10 ONLY. Be thorough and detailed.\n9. ONGOING MONITORING PROGRAMME (tailored to this property type — specify monthly, quarterly, six-monthly and annual tasks with responsible parties and record-keeping requirements. Reference ACOP L8 and HSG274 frequencies.)\n10. ASSESSOR DECLARATION (reproduce verbatim): "This assessment was carried out by ${assessor} on behalf of ${COMPANY.tradingAs} / ${COMPANY.name} on ${date}. The assessor holds a current Legionella risk assessment qualification (${CERT.company}, Cert No. ${CERT.certNo}, valid to ${CERT.validTo}). The findings and recommendations are based solely on conditions observed at the time of the site visit."`;

      setStatus('Writing report sections (4 parallel passes)…');
      setProgress(55);

      const [p1, p2, p3, p4] = await Promise.all([
        base44.integrations.Core.InvokeLLM({ prompt: pass1Prompt, model: 'claude_sonnet_4_6' }),
        base44.integrations.Core.InvokeLLM({ prompt: pass2Prompt, model: 'claude_sonnet_4_6' }),
        base44.integrations.Core.InvokeLLM({ prompt: pass3Prompt, model: 'claude_sonnet_4_6' }),
        base44.integrations.Core.InvokeLLM({ prompt: pass4Prompt, model: 'claude_sonnet_4_6' }),
      ]);

      const strip = (s) => (typeof s === 'string' ? s : JSON.stringify(s)).replace(/^```(?:html)?\s*/i, '').replace(/\s*```\s*$/i, '');
      const html = strip(p1) + strip(p2) + strip(p3) + strip(p4);

      setReport(html);
      setProgress(100);
      setStatus('Report generated and saved to job.');
      saveToJob(html, notes, photos);
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
      <defs><marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#2C3E50"/></marker></defs>
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
      <text x="30" y="298" fill="#666" font-size="9">Indicative only — based on site observations.</text>
    </svg>`;
  };

  const buildPhotoGrid = () => {
    if (!photos.length) return '';
    return `<div style="margin-top:8px;">${photos.map((p, i) => {
      const src = p.cdnUrl || p.dataUrl;
      if (!src) return '';
      return `<div style="display:inline-block;width:30%;margin:1%;vertical-align:top;page-break-inside:avoid;">
        <img src="${src}" style="width:100%;height:160px;object-fit:cover;border-radius:4px;border:1px solid #ddd;" />
        <div style="font-size:9pt;color:#555;margin-top:4px;text-align:center;">${p.caption || `Photo ${i+1}`}</div>
      </div>`;
    }).join('')}</div>`;
  };

  const printReport = () => {
    const coverChoice = photos.find(p => p.isCover) || photos[0];
    const coverPhoto  = coverChoice?.cdnUrl || coverChoice?.dataUrl || '';
    const riskStyle   = RISK_STYLES[(job?.risk_level || '').toUpperCase()] || { bg: '#95A5A6', fg: '#fff', label: job?.risk_level || 'NOT SET' };
    const siteName    = job?.site_name || job?.client || 'Site';
    const date        = job?.assessment_date || new Date().toISOString().slice(0, 10);

    const coverPage = `<div style="page-break-after:always;min-height:100vh;display:flex;flex-direction:column;background:#fff;">
  <div style="background:#C0392B;color:white;padding:20px 30px;display:flex;align-items:center;justify-content:space-between;">
    <div>
      <div style="font-size:22pt;font-weight:bold;letter-spacing:1px;">${COMPANY.tradingAs}</div>
      <div style="font-size:10pt;opacity:0.85;margin-top:2px;">${COMPANY.name} · Gas Safe No. ${COMPANY.gasSafe} · Reg. ${COMPANY.companyReg}</div>
    </div>
    <div style="text-align:right;font-size:9pt;opacity:0.85;">
      <div>${COMPANY.tradingTel}</div><div>${COMPANY.tradingWeb}</div><div>${COMPANY.email}</div>
    </div>
  </div>
  ${coverPhoto
    ? `<div style="height:340px;overflow:hidden;"><img src="${coverPhoto}" style="width:100%;height:340px;object-fit:cover;" /></div>`
    : `<div style="height:340px;background:linear-gradient(135deg,#2C3E50 0%,#C0392B 100%);display:flex;align-items:center;justify-content:center;"><div style="font-size:60pt;opacity:0.2;">💧</div></div>`
  }
  <div style="padding:24px 30px;border-top:4px solid #C0392B;flex:1;">
    <div style="font-size:8pt;color:#C0392B;font-weight:bold;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">Legionella Risk Assessment Report</div>
    <div style="font-size:22pt;font-weight:bold;color:#2C3E50;">${siteName}</div>
    ${job?.address ? `<div style="font-size:11pt;color:#666;margin-top:4px;">${job.address}</div>` : ''}
    <div style="margin-top:16px;display:flex;gap:24px;flex-wrap:wrap;">
      <div><span style="font-size:8pt;color:#999;text-transform:uppercase;">Property Type</span><br/><strong style="color:#2C3E50;">${job?.property_type || '—'}</strong></div>
      <div><span style="font-size:8pt;color:#999;text-transform:uppercase;">Assessment Date</span><br/><strong style="color:#2C3E50;">${date}</strong></div>
      <div><span style="font-size:8pt;color:#999;text-transform:uppercase;">Assessor</span><br/><strong style="color:#2C3E50;">${job?.assessor || CERT.assessor}</strong></div>
      <div><span style="font-size:8pt;color:#999;text-transform:uppercase;">Overall Risk</span><br/><strong style="background:${riskStyle.bg};color:${riskStyle.fg};padding:2px 12px;border-radius:3px;">${riskStyle.label}</strong></div>
      <div><span style="font-size:8pt;color:#999;text-transform:uppercase;">Report Ref</span><br/><strong style="color:#2C3E50;">${job?.report_ref || '—'}</strong></div>
    </div>
  </div>
  <div style="background:#2C3E50;color:white;padding:10px 30px;font-size:8pt;display:flex;justify-content:space-between;align-items:center;">
    <div>Qualification: ${CERT.company} · Cert No. ${CERT.certNo} · Valid to ${CERT.validTo}</div>
    <div>CONFIDENTIAL — For the attention of the Duty Holder only</div>
  </div>
</div>`;

    const schematic = `<div style="page-break-inside:avoid;margin:20px 0;">
  <h2 style="color:#C0392B;font-size:13pt;border-bottom:1px solid #C0392B;padding-bottom:4px;">Water System Schematic</h2>
  ${buildSchematicSvg()}
</div>`;

    const photosSection = photos.length > 0 ? `<div style="page-break-before:always;">
  <h2 style="color:#C0392B;font-size:13pt;border-bottom:1px solid #C0392B;padding-bottom:4px;">Site Photographs</h2>
  <p style="font-size:9pt;color:#666;">The following photographs were taken during the site visit on ${date}.</p>
  ${buildPhotoGrid()}
</div>` : '';

    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
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
</style></head><body>
${coverPage}
<div style="padding:0 4mm;">
<div class="page-footer">${COMPANY.tradingAs} | Gas Safe No. ${COMPANY.gasSafe} | Reg. ${COMPANY.companyReg} | VAT ${COMPANY.vat} | ${COMPANY.tradingTel} | ${COMPANY.tradingWeb}</div>
${schematic}
${report}
${photosSection}
</div></body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 800);
  };

  const riskColour = (level) => RISK_STYLES[(level || '').toUpperCase()] || { bg: '#95A5A6', fg: '#fff', label: level || '—' };

  return (
    <div style={{ padding: '16px', fontFamily: 'Arial, sans-serif', color: BRAND_DARK }}>

      {/* Header */}
      <div style={{ marginBottom: '16px', borderBottom: `3px solid ${BRAND_RED}`, paddingBottom: '10px' }}>
        <h2 style={{ margin: 0, color: BRAND_RED, fontSize: '18px' }}>AI Direct Report Generator</h2>
        <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#666' }}>{COMPANY.tradingAs} — ACOP L8 / BS 8580-1:2019 Compliant</p>
      </div>

      {/* Job summary bar */}
      {job && (
        <div style={{ background: '#f4f4f4', borderLeft: `4px solid ${BRAND_RED}`, padding: '10px 14px', marginBottom: '14px', fontSize: '13px' }}>
          <strong>{job.site_name || job.client || 'Unnamed site'}</strong>
          {job.address && <span style={{ marginLeft: '10px', color: '#555' }}>{job.address}</span>}
          {job.property_type && <span style={{ marginLeft: '10px', background: BRAND_DARK, color: '#fff', padding: '1px 8px', borderRadius: '3px', fontSize: '11px' }}>{job.property_type}</span>}
          {job.risk_level && <span style={{ marginLeft: '8px', background: riskColour(job.risk_level).bg, color: riskColour(job.risk_level).fg, padding: '1px 8px', borderRadius: '3px', fontSize: '11px', fontWeight: 'bold' }}>{riskColour(job.risk_level).label}</span>}
        </div>
      )}

      {/* Photo drop zone */}
      <div
        onDrop={onDrop} onDragOver={onDragOver} onClick={() => fileRef.current?.click()}
        style={{ border: `2px dashed ${BRAND_RED}`, borderRadius: '6px', padding: '16px', textAlign: 'center', cursor: 'pointer', marginBottom: '12px', background: '#fdf9f9' }}
      >
        <div style={{ fontSize: '24px', marginBottom: '4px' }}>📷</div>
        <div style={{ fontSize: '13px', color: '#555' }}>Drag &amp; drop site photos, or click to select</div>
        <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>★ star = cover photo &nbsp;·&nbsp; resized to 1200px automatically</div>
        <input ref={fileRef} type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={onFileChange} />
      </div>

      {/* Photo thumbnails */}
      {photos.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
          {photos.map((p, i) => (
            <div key={i} style={{ position: 'relative', width: '110px' }}>
              <img src={p.dataUrl || p.cdnUrl} alt="" style={{ width: '110px', height: '82px', objectFit: 'cover', borderRadius: '4px', border: p.isCover ? `3px solid ${BRAND_RED}` : '1px solid #ddd' }} />
              <button onClick={() => removePhoto(i)} title="Remove" style={{ position: 'absolute', top: '2px', right: '2px', background: BRAND_RED, color: '#fff', border: 'none', borderRadius: '50%', width: '18px', height: '18px', cursor: 'pointer', fontSize: '10px', lineHeight: '18px', textAlign: 'center', padding: 0 }}>×</button>
              <button onClick={() => setCover(i)} title="Set as cover photo" style={{ position: 'absolute', top: '2px', left: '2px', background: p.isCover ? BRAND_RED : 'rgba(255,255,255,0.85)', color: p.isCover ? '#fff' : '#aaa', border: 'none', borderRadius: '50%', width: '18px', height: '18px', cursor: 'pointer', fontSize: '11px', lineHeight: '18px', textAlign: 'center', padding: 0 }}>★</button>
              {p.isCover && <div style={{ fontSize: '9px', color: BRAND_RED, fontWeight: 'bold', textAlign: 'center', marginTop: '2px' }}>COVER</div>}
              <input value={p.caption} onChange={e => updateCaption(i, e.target.value)} placeholder="Caption…" style={{ width: '100%', marginTop: '2px', fontSize: '10px', padding: '2px 3px', border: '1px solid #ccc', borderRadius: '3px', boxSizing: 'border-box' }} />
            </div>
          ))}
        </div>
      )}

      {/* Engineer notes */}
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px', color: BRAND_DARK }}>Engineer Notes:</label>
        <textarea
          value={notes} onChange={e => handleNotesChange(e.target.value)} rows={7}
          placeholder={`Site: [name], visited [date]\nResponsible person: [name / title]\nCold water tank: [location, condition, lid present Y/N]\nCalorifier: [make, model, last service]\nHot outlets tested: [locations + temps]\nCold outlets tested: [locations + temps]\nTMVs: [locations, set temps, last tested]\nShowers: [locations, condition, last descaled]\nDead legs: Y/N\nAC units: [make, location, last serviced]`}
          style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace', boxSizing: 'border-box', resize: 'vertical' }}
        />
      </div>

      {/* Generate button */}
      <button onClick={generate} disabled={loading}
        style={{ background: loading ? '#ccc' : BRAND_RED, color: '#fff', border: 'none', padding: '12px 28px', borderRadius: '5px', fontSize: '14px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', width: '100%', marginBottom: '8px' }}>
        {loading ? 'Generating…' : report ? '🔄 Regenerate Report' : '⚡ Generate Full Report with AI'}
      </button>

      {/* Progress */}
      {(loading || status) && (
        <div style={{ marginBottom: '12px' }}>
          {progress > 0 && progress < 100 && (
            <div style={{ background: '#eee', borderRadius: '4px', height: '6px', marginBottom: '4px' }}>
              <div style={{ background: BRAND_RED, height: '6px', borderRadius: '4px', width: `${progress}%`, transition: 'width 0.3s' }} />
            </div>
          )}
          <div style={{ fontSize: '12px', color: '#555' }}>{status}</div>
        </div>
      )}

      {/* Report actions + edit/preview */}
      {report && (
        <div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
            <button onClick={printReport}
              style={{ background: BRAND_DARK, color: '#fff', border: 'none', padding: '8px 18px', borderRadius: '5px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}>
              🖨️ Print / Save PDF
            </button>
            <button onClick={() => setEditing(e => !e)}
              style={{ background: editing ? '#666' : '#f0f0f0', color: editing ? '#fff' : BRAND_DARK, border: `1px solid #ccc`, padding: '8px 18px', borderRadius: '5px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}>
              {editing ? '👁️ Preview' : '✏️ Edit HTML'}
            </button>
            <span style={{ fontSize: '11px', color: '#27AE60', alignSelf: 'center' }}>✅ Saved to job</span>
          </div>

          {editing ? (
            <div>
              <p style={{ fontSize: '11px', color: '#888', marginBottom: '6px' }}>Edit the HTML below — changes save automatically to the job.</p>
              <textarea
                value={report}
                onChange={e => handleReportChange(e.target.value)}
                rows={30}
                style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.4 }}
              />
            </div>
          ) : (
            <div style={{ border: '1px solid #ddd', borderRadius: '6px', padding: '20px', background: '#fff', fontSize: '12px', lineHeight: 1.6 }}
              dangerouslySetInnerHTML={{ __html: report }} />
          )}
        </div>
      )}
    </div>
  );
}
import React, { useState, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { fileToDataUrl } from '@/lib/photoUpload';

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
  const { file_url } = await base44.integrations.Core.UploadFile({
    file: new File([blob], 'photo.jpg', { type: 'image/jpeg' }),
  });
  return { dataUrl: resized, cdnUrl: file_url };
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
        processed.push({ file: arr[i], ...result, caption: arr[i].name });
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

  const generate = async () => {
    if (!job) { setStatus('No job loaded.'); return; }
    setLoading(true);
    setReport('');
    setStatus('Building prompt…');
    setProgress(10);
    try {
      const images = [];
      for (let i = 0; i < photos.length; i++) {
        setStatus(`Attaching photo ${i + 1} of ${photos.length}…`);
        setProgress(10 + Math.round((i / photos.length) * 40));
        const b64 = photos[i].dataUrl.split(',')[1];
        if (b64) images.push({ data: b64, mediaType: 'image/jpeg', caption: photos[i].caption || '' });
      }
      setStatus('Sending to Claude — this may take 30–60 seconds…');
      setProgress(55);
      const response = await base44.functions.invoke('generateLraReport', { job, notes, images });
      setProgress(85);
      const reportHtml = response.data?.report || '';
      if (!reportHtml) throw new Error(response.data?.error || 'No report returned');
      setReport(reportHtml);
      setStatus('Report generated successfully.');
      setProgress(100);
    } catch (e) {
      setStatus(`Error: ${e.message}`);
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const printReport = () => {
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head>
<meta charset="utf-8">
<title>Legionella Risk Assessment — ${job?.site_name || 'Report'}</title>
<style>
  @page { margin: 18mm 15mm 22mm 15mm; }
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #2C3E50; line-height: 1.5; }
  h1 { color: #C0392B; font-size: 16pt; border-bottom: 2px solid #C0392B; padding-bottom: 4px; }
  h2 { color: #C0392B; font-size: 13pt; margin-top: 18px; }
  h3 { color: #2C3E50; font-size: 11pt; margin-top: 12px; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 10pt; }
  th { background: #2C3E50; color: #fff; padding: 6px 8px; text-align: left; }
  td { border: 1px solid #ccc; padding: 5px 8px; vertical-align: top; }
  tr:nth-child(even) td { background: #f7f7f7; }
  .risk-high   { background: #C0392B; color: #fff; padding: 2px 8px; border-radius: 3px; font-weight: bold; }
  .risk-medium { background: #E67E22; color: #fff; padding: 2px 8px; border-radius: 3px; font-weight: bold; }
  .risk-low    { background: #27AE60; color: #fff; padding: 2px 8px; border-radius: 3px; font-weight: bold; }
  .page-footer { position: fixed; bottom: 0; left: 0; right: 0; font-size: 8pt; color: #666; border-top: 1px solid #ccc; padding: 4px 0; text-align: center; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head><body>
<div class="page-footer">${COMPANY.tradingAs} &nbsp;|&nbsp; Gas Safe No. ${COMPANY.gasSafe} &nbsp;|&nbsp; Company Reg. ${COMPANY.companyReg} &nbsp;|&nbsp; VAT ${COMPANY.vat} &nbsp;|&nbsp; ${COMPANY.tradingTel} &nbsp;|&nbsp; ${COMPANY.tradingWeb}</div>
${report}
</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 600);
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
              <img src={p.dataUrl} alt="" style={{ width: '120px', height: '90px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #ddd' }} />
              <button onClick={() => removePhoto(i)} style={{ position: 'absolute', top: '2px', right: '2px', background: BRAND_RED, color: '#fff', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', fontSize: '11px', lineHeight: '20px', textAlign: 'center', padding: 0 }}>×</button>
              <input value={p.caption} onChange={e => updateCaption(i, e.target.value)} placeholder="Caption…" style={{ width: '100%', marginTop: '4px', fontSize: '11px', padding: '2px 4px', border: '1px solid #ccc', borderRadius: '3px', boxSizing: 'border-box' }} />
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
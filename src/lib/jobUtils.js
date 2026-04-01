export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export const templateOutlets = {
  'Nursing Home': [['Main Kitchen','Kitchen Sink'],['Laundry','Cleaner Sink'],['Room 1 Ensuite','WHB'],['Room 1 Ensuite','Shower'],['Room 2 Ensuite','WHB'],['Room 2 Ensuite','Shower'],['Accessible Bathroom','WHB'],['Accessible Bathroom','Shower'],['Staff WC','WHB']],
  'Care Home': [['Kitchen','Kitchen Sink'],['Laundry','Cleaner Sink'],['Communal Bathroom','WHB'],['Communal Bathroom','Shower'],['Accessible Bathroom','WHB'],['Accessible Bathroom','Shower']],
  'Holiday Park': [['Gents','WHB'],['Gents','Shower'],['Ladies','WHB'],['Ladies','Shower'],['Disabled','WHB'],['Disabled','Shower'],['Kitchen','Kitchen Sink']],
  'Factory Unit': [['Kitchen','Kitchen Sink'],['WC','WHB']],
  'Domestic': [['Kitchen','Kitchen Sink'],['Bathroom','WHB'],['Bathroom','Bath'],['Bathroom','Shower']]
};

export function blankJob() {
  return {
    client: '', site_name: '', address: '', property_type: 'Nursing Home',
    assessment_date: today(), review_due: '', report_ref: '', visit_dates: '',
    status: 'In Progress', risk: 'MEDIUM', risk_override: false, summary: '',
    duty_holder: '', duty_holder_role: '', responsible_person: '', responsible_role: '',
    deputy_person: '', deputy_role: '', assessor: '', reviewer: '',
    written_scheme: false, schematics_available: false, training_records: false,
    monitoring_records: false, vulnerable_users: true, cqc_mode: true, compliance_notes: '',
    site_description: '', occupants: '', cold_source: 'Mains', hot_system: '',
    cwst_present: false, tmvs_installed: true, air_con: false, closed_systems: false,
    ac_last_service_date: '',
    cwst_location: '', cwst_temp: '', cwst_clean: true, cwst_drinking: false, restrictions: '',
    cylinder_temp: '', hw_not_stored: false, hw_boiler_set_temp: '',
    monthly_temp_log: true, flushing_log: true, shower_cleaning_log: true, tmv_service_records: true,
    log_temps_na: false, log_flush_na: false, log_shower_na: false, log_tmv_na: false,
    risk_contam: '2', risk_amplify: '2', risk_transmit: '2', risk_suscept: '4',
    issues_text: '',
    cover_photo_url: '',
    outlets: [], actions: [], photos: [], logs: []
  };
}

export function outletStatus(o, cqcMode) {
  const hot = parseFloat(o.hot), cold = parseFloat(o.cold);
  const isOutsideTap = o.type === 'Outside Tap';

  if (isOutsideTap) {
    if (!o.hasCheckValve && !o.check_valve) return { text: 'No check valve', cls: 'warn' };
    if (!isNaN(cold) && cold > 20) return { text: 'Cold high', cls: 'warn' };
    return { text: 'Pass', cls: 'ok' };
  }

  if (!isNaN(cold) && cold >= 30) return { text: 'Urgent', cls: 'fail' };
  if (!isNaN(cold) && cold > 20) return { text: 'Check', cls: 'warn' };

  if (o.hasTmv) {
    if (!isNaN(hot)) {
      if (hot > 46) return { text: 'Too hot', cls: 'fail' };
      if (hot < 38) return { text: 'Too cold', cls: 'fail' };
    }
    return { text: 'Pass', cls: 'ok' };
  }

  const target = o.type === 'Pot Wash' ? 60 : (cqcMode ? 55 : 50);
  if (!isNaN(hot) && hot < 20) return { text: 'Urgent', cls: 'fail' };
  if (!isNaN(hot) && hot < target) return { text: 'Check', cls: 'warn' };
  if (o.infrequent) return { text: 'Check', cls: 'warn' };
  return { text: 'Pass', cls: 'ok' };
}

export function buildControlScheme(job) {
  const targetTemp = job.cqc_mode ? 55 : 50;
  const rp = job.responsible_person || 'Responsible Person';
  const dh = job.duty_holder || 'Duty Holder';
  const rows = [
    ['Management review of records and results', 'Six monthly', 'Responsible person to review records and adverse trends', rp, 'Compliance review'],
    ['Review of appointments, training and competency', 'Six monthly', 'Confirm Duty Holder / Responsible Person structure remains valid', dh, 'Management review'],
    ['Risk assessment and written scheme review', 'At least every two years or sooner on change', 'Review on system/use/personnel changes or adverse findings', dh, 'Assessment review'],
    ['Refresh training for involved personnel', 'At least every three years', 'Maintain competency records', dh, 'Training records'],
    ['Hot water sentinel temperatures', 'Monthly', `At least ${targetTemp}°C within one minute`, rp, 'Temperature log'],
    ['Cold water sentinel temperatures', 'Monthly', 'Below 20°C within two minutes', rp, 'Temperature log'],
    ['Representative rotational outlet temperatures', 'Rotational basis', 'Build a profile of the whole system', rp, 'Temperature log'],
    ['Infrequently used outlets flushing', 'Weekly', 'Flush until temperature stabilises and record', rp, 'Flushing log'],
  ];
  if (job.tmvs_installed) rows.push(['TMV inspection/clean/descale/failsafe checks', 'Annually', 'Inspect associated strainers/filters and test', rp, 'TMV maintenance record']);
  if ((job.outlets || []).some(o => o.type === 'Shower')) rows.push(['Shower heads clean/descale', 'Six monthly', 'Remove, clean and disinfect', rp, 'Cleaning log']);
  if (job.cwst_present) {
    rows.splice(5, 0, ['CWST inspection', 'Six monthly', 'Inspect condition, lid, insulation and temperature', rp, 'CWST inspection record']);
    rows.splice(6, 0, ['CWST cleaning/disinfection', 'As required / periodic', 'Undertake where condition or findings require', dh, 'Remedial record']);
  }
  if (job.air_con) rows.push(['Air conditioning service', 'Annually', 'Service by competent engineer', dh, 'Service record']);
  return rows;
}

export function calculateRisk(job) {
  let score = 0;
  const pt = job.property_type || '';
  const isCare = pt === 'Nursing Home' || pt === 'Care Home';
  const isHoliday = pt === 'Holiday Park';
  const isDomestic = pt === 'Domestic';
  const isMedical = pt === 'Doctors Surgery' || pt === 'Dental Surgery';

  if (pt === 'Nursing Home' || pt === 'Care Home') score += 3;
  else if (isMedical) score += 2;
  else if (isHoliday || pt === 'Factory Unit' || pt === 'Commercial') score += 1;
  else if (isDomestic) score += 0;
  else score += 1;

  if (job.vulnerable_users) score += isCare ? 2 : 1;

  const outlets = job.outlets || [];
  const hotTarget = isCare ? 55 : 50;
  let tempFails = 0;
  outlets.forEach(o => {
    const hot = parseFloat(o.hot), cold = parseFloat(o.cold);
    if (o.type !== 'Outside Tap') {
      if (o.hasTmv) { if (!isNaN(hot) && (hot < 38 || hot > 46)) tempFails++; }
      else { const t = o.type === 'Pot Wash' ? 60 : hotTarget; if (!isNaN(hot) && hot < t) tempFails++; }
    }
    if (!isNaN(cold) && cold > 20) tempFails++;
  });
  const tempMult = isCare ? 1.5 : isMedical ? 1.2 : 1;
  score += Math.round((tempFails >= 3 ? 3 : tempFails >= 1 ? 2 : 0) * tempMult);

  const urgent = outlets.some(o => { const hot = parseFloat(o.hot), cold = parseFloat(o.cold); return (!isNaN(hot) && hot < 45) || (!isNaN(cold) && cold >= 25); });
  if (urgent) score += isCare ? 3 : 2;

  if (job.cwst_present) score += 1;
  if (job.cwst_present && !job.cwst_clean) score += isCare ? 3 : 2;

  const hasShower = outlets.some(o => o.type === 'Shower');
  if (hasShower) score += isCare ? 2 : 1;

  const dlCount = (job.dead_legs || []).length;
  score += Math.min(dlCount * (isCare ? 2 : 1), isCare ? 6 : 4);

  if (job.hw_not_stored) {
    const bt = parseFloat(job.hw_boiler_set_temp);
    if (!isNaN(bt) && bt < 60) score += isCare ? 2 : 1;
  } else {
    const hwTemp = parseFloat(job.cylinder_temp);
    if (!isNaN(hwTemp) && hwTemp < 60) score += isCare ? 3 : 2;
  }

  if (!job.log_temps_na && !job.monthly_temp_log) score += isCare ? 3 : isDomestic ? 1 : 2;
  if (!job.log_flush_na && !job.flushing_log) score += isCare ? 2 : 1;
  if (!job.log_shower_na && !job.shower_cleaning_log && hasShower) score += isCare ? 2 : 1;
  if (!job.log_tmv_na && !job.tmv_service_records && job.tmvs_installed) score += isCare ? 2 : 1;

  const isAcHigh = job.air_con && (!job.ac_last_service_date || new Date(job.ac_last_service_date) < new Date(new Date().setFullYear(new Date().getFullYear() - 1)));
  if (isAcHigh) score += 3;

  let result;
  if (isCare) result = score >= 9 ? 'HIGH' : score >= 4 ? 'MEDIUM' : 'LOW';
  else if (isDomestic) result = score >= 5 ? 'HIGH' : score >= 2 ? 'MEDIUM' : 'LOW';
  else if (isMedical) result = score >= 7 ? 'HIGH' : score >= 3 ? 'MEDIUM' : 'LOW';
  else result = score >= 7 ? 'HIGH' : score >= 3 ? 'MEDIUM' : 'LOW';

  if (job.vulnerable_users && result === 'LOW') result = 'MEDIUM';
  if (isMedical && result === 'LOW') result = 'MEDIUM';
  if (isAcHigh) result = 'HIGH';
  // CWST > 20°C always HIGH
  const cwstT = parseFloat(job.cwst_temp);
  if (job.cwst_present && !isNaN(cwstT) && cwstT > 20) result = 'HIGH';
  return result;
}

export function reportChecks(job) {
  return [
    ['Client entered', !!(job.client || '').trim()],
    ['Site name entered', !!(job.site_name || '').trim()],
    ['Duty Holder entered', !!(job.duty_holder || '').trim()],
    ['Responsible Person entered', !!(job.responsible_person || '').trim()],
    ['Assessor entered', !!(job.assessor || '').trim()],
    ['Executive summary written', !!(job.summary || '').trim()],
    ['At least one outlet recorded', (job.outlets || []).length > 0],
    ['Front cover photo added', (job.photos || []).some(p => p.kind === 'Cover Photo')],
    ['All photos captioned', (job.photos || []).every(p => p.kind && (p.location || '').trim() && (p.caption || '').trim())],
  ];
}
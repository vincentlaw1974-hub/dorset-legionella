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
    status: 'In Progress', risk: 'LOW', summary: '',
    duty_holder: '', duty_holder_role: '', responsible_person: '', responsible_role: '',
    deputy_person: '', deputy_role: '', assessor: '', reviewer: '',
    written_scheme: false, schematics_available: false, training_records: false,
    monitoring_records: false, vulnerable_users: true, cqc_mode: true, compliance_notes: '',
    site_description: '', occupants: '', cold_source: 'Mains', hot_system: '',
    cwst_present: false, tmvs_installed: true, air_con: false, closed_systems: false,
    cwst_location: '', cwst_temp: '', cwst_clean: true, cwst_drinking: false, restrictions: '',
    risk_contam: '2', risk_amplify: '2', risk_transmit: '2', risk_suscept: '4',
    outlets: [], actions: [], photos: [], logs: []
  };
}

export function outletStatus(o, cqcMode) {
  const hot = parseFloat(o.hot), cold = parseFloat(o.cold);
  const target = o.type === 'Pot Wash' ? 60 : (cqcMode ? 55 : 50);
  if ((!isNaN(hot) && hot < 20) || (!isNaN(cold) && cold >= 30)) return { text: 'Urgent', cls: 'fail' };
  if ((!isNaN(hot) && hot < target) || (!isNaN(cold) && cold > 20) || o.infrequent) return { text: 'Check', cls: 'warn' };
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
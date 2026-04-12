import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { blankJob } from '@/lib/jobUtils';

const PROPERTY_TYPES = ['Nursing Home','Care Home','Holiday Park','Factory Unit','Domestic','Commercial','Doctors Surgery','Dental Surgery','Other'];
const STATUS_COLORS = { 'In Progress': '#d97706', 'Completed': '#16a34a', 'Reviewed': '#2563eb', 'Future': '#7c3aed' };
const RISK_COLORS = { LOW: '#16a34a', MEDIUM: '#d97706', HIGH: '#dc2626' };

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-base">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function CustomerForm({ initial = {}, onSave, onCancel }) {
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', address: '', notes: '', ...initial });
  const f = (field) => ({ value: form[field] || '', onChange: e => setForm(p => ({ ...p, [field]: e.target.value })) });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Name *</Label><Input {...f('name')} placeholder="Contact name" /></div>
        <div><Label>Company</Label><Input {...f('company')} placeholder="Organisation" /></div>
        <div><Label>Email</Label><Input {...f('email')} type="email" /></div>
        <div><Label>Phone</Label><Input {...f('phone')} /></div>
      </div>
      <div><Label>Address</Label><Input {...f('address')} /></div>
      <div><Label>Notes</Label><Textarea {...f('notes')} className="min-h-[80px]" /></div>
      <div className="flex gap-2 justify-end pt-2">
        <button onClick={onCancel} className="px-4 py-2 rounded-xl border border-gray-300 text-sm font-medium hover:bg-gray-50">Cancel</button>
        <button onClick={() => form.name.trim() && onSave(form)} className="px-4 py-2 rounded-xl text-white text-sm font-bold" style={{ background: '#d71920' }}>Save</button>
      </div>
    </div>
  );
}

function PropertyForm({ initial = {}, customers = [], onSave, onCancel }) {
  const [form, setForm] = useState({ site_name: '', address: '', property_type: 'Commercial', customer_id: '', notes: '', ...initial });
  const f = (field) => ({ value: form[field] || '', onChange: e => setForm(p => ({ ...p, [field]: e.target.value })) });
  return (
    <div className="space-y-3">
      <div><Label>Site name *</Label><Input {...f('site_name')} placeholder="e.g. The Willows Care Home" /></div>
      <div><Label>Address</Label><Input {...f('address')} /></div>
      <div>
        <Label>Property type</Label>
        <select value={form.property_type} onChange={e => setForm(p => ({ ...p, property_type: e.target.value }))}
          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm mt-1">
          {PROPERTY_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div>
        <Label>Customer (optional)</Label>
        <select value={form.customer_id} onChange={e => {
          const c = customers.find(c => c.id === e.target.value);
          setForm(p => ({ ...p, customer_id: e.target.value, customer_name: c?.name || '' }));
        }} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm mt-1">
          <option value="">— Standalone / no customer —</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</option>)}
        </select>
      </div>
      <div><Label>Notes</Label><Textarea {...f('notes')} className="min-h-[70px]" /></div>
      <div className="flex gap-2 justify-end pt-2">
        <button onClick={onCancel} className="px-4 py-2 rounded-xl border border-gray-300 text-sm font-medium hover:bg-gray-50">Cancel</button>
        <button onClick={() => form.site_name.trim() && onSave(form)} className="px-4 py-2 rounded-xl text-white text-sm font-bold" style={{ background: '#d71920' }}>Save</button>
      </div>
    </div>
  );
}

function NewJobForm({ customer, onSave, onCancel }) {
  const [siteName, setSiteName] = useState('');
  const [propertyType, setPropertyType] = useState('Commercial');
  return (
    <div className="space-y-3">
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-sm text-blue-800">
        Creating job for <strong>{customer.name}</strong>{customer.company ? ` (${customer.company})` : ''}
      </div>
      <div>
        <Label>Site name *</Label>
        <Input value={siteName} onChange={e => setSiteName(e.target.value)} placeholder="e.g. The Willows, Main Street Branch" />
      </div>
      <div>
        <Label>Property type</Label>
        <select value={propertyType} onChange={e => setPropertyType(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm mt-1">
          {PROPERTY_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <button onClick={onCancel} className="px-4 py-2 rounded-xl border border-gray-300 text-sm font-medium hover:bg-gray-50">Cancel</button>
        <button
          onClick={() => siteName.trim() && onSave({ ...blankJob(), site_name: siteName.trim(), client: customer.name, property_type: propertyType, customer_id: customer.id, customer_name: customer.name })}
          className="px-4 py-2 rounded-xl text-white text-sm font-bold" style={{ background: '#d71920' }}>
          Create job
        </button>
      </div>
    </div>
  );
}

export default function Customers() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showTab, setShowTab] = useState('customers');
  const [modal, setModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: () => base44.entities.Customer.list('-created_date') });
  const { data: properties = [] } = useQuery({ queryKey: ['properties'], queryFn: () => base44.entities.Property.list('-created_date') });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list('-created_date') });

  const createCustomer = useMutation({ mutationFn: d => base44.entities.Customer.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); setModal(null); } });
  const updateCustomer = useMutation({ mutationFn: ({ id, ...d }) => base44.entities.Customer.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); setModal(null); } });
  const deleteCustomer = useMutation({ mutationFn: id => base44.entities.Customer.delete(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); setSelectedCustomer(null); setConfirmDelete(null); } });

  const createProperty = useMutation({ mutationFn: d => base44.entities.Property.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['properties'] }); setModal(null); } });
  const updateProperty = useMutation({ mutationFn: ({ id, ...d }) => base44.entities.Property.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['properties'] }); setModal(null); } });
  const deleteProperty = useMutation({ mutationFn: id => base44.entities.Property.delete(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['properties'] }); setConfirmDelete(null); } });

  const createJob = useMutation({
    mutationFn: d => base44.entities.Job.create(d),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      setModal(null);
      // Navigate to home and open job
      window.location.href = `/?job=${created.id}`;
    }
  });

  const filteredCustomers = customers.filter(c =>
    [c.name, c.company, c.email].some(v => v?.toLowerCase().includes(search.toLowerCase()))
  );
  const standaloneProperties = properties.filter(p => !p.customer_id);
  const customerProperties = (id) => properties.filter(p => p.customer_id === id);
  const customerJobs = (id) => jobs.filter(j => j.customer_id === id);

  return (
    <div className="min-h-screen" style={{ background: '#f6f7f9' }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/" className="text-gray-400 hover:text-gray-700 text-sm font-medium">← Back</a>
          <div className="w-px h-5 bg-gray-200" />
          <h1 className="font-bold text-base">Customer Database</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setModal({ type: 'new-property' })} className="px-3 py-2 rounded-xl text-sm font-semibold bg-white border border-gray-300 text-gray-700 hover:bg-gray-50">+ Property</button>
          <button onClick={() => setModal({ type: 'new-customer' })} className="px-3 py-2 rounded-xl text-sm font-bold text-white" style={{ background: '#d71920' }}>+ Customer</button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-3 py-4 flex flex-col lg:flex-row gap-4">
        {/* Left panel */}
        <div className="w-full lg:w-80 flex-shrink-0 space-y-3">
          <div className="flex gap-1 bg-white border border-gray-200 rounded-2xl p-1 shadow-sm">
            <button onClick={() => setShowTab('customers')} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${showTab === 'customers' ? 'text-white' : 'text-gray-600 hover:bg-gray-50'}`} style={showTab === 'customers' ? { background: '#d71920' } : {}}>
              👤 Customers ({customers.length})
            </button>
            <button onClick={() => { setShowTab('standalone'); setSelectedCustomer(null); }} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${showTab === 'standalone' ? 'text-white' : 'text-gray-600 hover:bg-gray-50'}`} style={showTab === 'standalone' ? { background: '#d71920' } : {}}>
              🏢 Standalone ({standaloneProperties.length})
            </button>
          </div>

          {showTab === 'customers' && (
            <>
              <Input placeholder="Search customers..." value={search} onChange={e => setSearch(e.target.value)} />
              <div className="space-y-2">
                {filteredCustomers.length === 0 && <div className="text-sm text-gray-400 text-center py-6">No customers yet.</div>}
                {filteredCustomers.map(c => {
                  const jCount = customerJobs(c.id).length;
                  const pCount = customerProperties(c.id).length;
                  const isSelected = selectedCustomer?.id === c.id;
                  return (
                    <button key={c.id} onClick={() => setSelectedCustomer(c)}
                      className={`w-full text-left px-4 py-3 rounded-2xl border-2 transition-all ${isSelected ? 'border-red-500 bg-red-50' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                      <div className="font-semibold text-sm">{c.name}</div>
                      {c.company && <div className="text-xs text-gray-500">{c.company}</div>}
                      <div className="flex gap-3 mt-1 text-xs text-gray-500">
                        <span>📋 {jCount} job{jCount !== 1 ? 's' : ''}</span>
                        <span>🏢 {pCount} site{pCount !== 1 ? 's' : ''}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {showTab === 'standalone' && (
            <div className="space-y-2">
              {standaloneProperties.length === 0 && <div className="text-sm text-gray-400 text-center py-6">No standalone properties.</div>}
              {standaloneProperties.map(p => (
                <div key={p.id} className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-sm">{p.site_name}</div>
                      {p.address && <div className="text-xs text-gray-500">{p.address}</div>}
                      <div className="text-xs text-gray-400 mt-1">{p.property_type}</div>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <button onClick={() => setModal({ type: 'edit-property', data: p })} className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200">Edit</button>
                      <button onClick={() => setConfirmDelete({ type: 'property', id: p.id, name: p.site_name })} className="text-xs px-2 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100">Del</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right panel */}
        {showTab === 'customers' && (
          <div className="flex-1">
            {!selectedCustomer ? (
              <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center text-gray-400 shadow-sm">
                Select a customer to view their details, jobs and properties
              </div>
            ) : (
              <div className="space-y-3">
                {/* Customer card */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="font-bold text-lg">{selectedCustomer.name}</h2>
                      {selectedCustomer.company && <div className="text-gray-500 text-sm">{selectedCustomer.company}</div>}
                      <div className="mt-2 space-y-1 text-sm text-gray-600">
                        {selectedCustomer.email && <div>✉ {selectedCustomer.email}</div>}
                        {selectedCustomer.phone && <div>📞 {selectedCustomer.phone}</div>}
                        {selectedCustomer.address && <div>📍 {selectedCustomer.address}</div>}
                      </div>
                      {selectedCustomer.notes && <div className="mt-3 text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2">{selectedCustomer.notes}</div>}
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button onClick={() => setModal({ type: 'edit-customer', data: selectedCustomer })} className="text-sm px-3 py-1.5 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200">Edit</button>
                      <button onClick={() => setConfirmDelete({ type: 'customer', id: selectedCustomer.id, name: selectedCustomer.name })} className="text-sm px-3 py-1.5 rounded-xl bg-red-50 text-red-600 font-medium hover:bg-red-100">Delete</button>
                    </div>
                  </div>
                </div>

                {/* Jobs section */}
                <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <strong className="text-sm">📋 Jobs ({customerJobs(selectedCustomer.id).length})</strong>
                    <button onClick={() => setModal({ type: 'new-job', customer: selectedCustomer })}
                      className="text-sm px-3 py-1.5 rounded-xl font-bold text-white" style={{ background: '#d71920' }}>
                      + Add job
                    </button>
                  </div>
                  {customerJobs(selectedCustomer.id).length === 0 && (
                    <div className="text-sm text-gray-400 text-center py-5">No jobs yet for this customer.</div>
                  )}
                  <div className="space-y-2">
                    {customerJobs(selectedCustomer.id).map(j => (
                      <a key={j.id} href={`/?job=${j.id}`}
                        className="flex items-center justify-between border border-gray-100 rounded-xl px-4 py-3 hover:bg-gray-50 transition-all cursor-pointer group">
                        <div className="min-w-0">
                          <div className="font-semibold text-sm group-hover:text-red-700">{j.site_name || j.client || 'Untitled'}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {j.property_type}{j.assessment_date ? ` · ${j.assessment_date}` : ''}
                            {j.address ? ` · ${j.address}` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                          {j.risk && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: (RISK_COLORS[j.risk] || '#999') + '22', color: RISK_COLORS[j.risk] || '#999' }}>
                              {j.risk}
                            </span>
                          )}
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: (STATUS_COLORS[j.status] || '#d97706') + '22', color: STATUS_COLORS[j.status] || '#d97706' }}>
                            {j.status || 'In Progress'}
                          </span>
                          <span className="text-gray-300 group-hover:text-red-400">→</span>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>

                {/* Properties section */}
                <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <strong className="text-sm">🏢 Properties ({customerProperties(selectedCustomer.id).length})</strong>
                    <button onClick={() => setModal({ type: 'new-property', preCustomer: selectedCustomer })} className="text-sm px-3 py-1.5 rounded-xl font-bold bg-white border border-gray-300 text-gray-700 hover:bg-gray-50">+ Add site</button>
                  </div>
                  {customerProperties(selectedCustomer.id).length === 0 && (
                    <div className="text-sm text-gray-400 text-center py-4">No properties recorded.</div>
                  )}
                  <div className="space-y-2">
                    {customerProperties(selectedCustomer.id).map(p => (
                      <div key={p.id} className="flex items-center justify-between border border-gray-100 rounded-xl px-4 py-3 hover:bg-gray-50">
                        <div>
                          <div className="font-semibold text-sm">{p.site_name}</div>
                          <div className="text-xs text-gray-500">{p.address}{p.property_type ? ` · ${p.property_type}` : ''}</div>
                        </div>
                        <div className="flex gap-1 ml-4">
                          <button onClick={() => setModal({ type: 'edit-property', data: p })} className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200">Edit</button>
                          <button onClick={() => setConfirmDelete({ type: 'property', id: p.id, name: p.site_name })} className="text-xs px-2 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100">Del</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {modal?.type === 'new-customer' && (
        <Modal title="New Customer" onClose={() => setModal(null)}>
          <CustomerForm onSave={d => createCustomer.mutate(d)} onCancel={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === 'edit-customer' && (
        <Modal title="Edit Customer" onClose={() => setModal(null)}>
          <CustomerForm initial={modal.data} onSave={d => updateCustomer.mutate({ id: modal.data.id, ...d })} onCancel={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === 'new-property' && (
        <Modal title="New Property" onClose={() => setModal(null)}>
          <PropertyForm
            initial={modal.preCustomer ? { customer_id: modal.preCustomer.id, customer_name: modal.preCustomer.name } : {}}
            customers={customers}
            onSave={d => createProperty.mutate(d)}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
      {modal?.type === 'edit-property' && (
        <Modal title="Edit Property" onClose={() => setModal(null)}>
          <PropertyForm initial={modal.data} customers={customers} onSave={d => updateProperty.mutate({ id: modal.data.id, ...d })} onCancel={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === 'new-job' && (
        <Modal title="New Job" onClose={() => setModal(null)}>
          <NewJobForm customer={modal.customer} onSave={d => createJob.mutate(d)} onCancel={() => setModal(null)} />
        </Modal>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h2 className="font-bold text-base mb-2">Delete {confirmDelete.type}?</h2>
            <p className="text-sm text-gray-600 mb-5">This will permanently delete <strong>{confirmDelete.name}</strong>.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-xl border border-gray-300 text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={() => confirmDelete.type === 'customer' ? deleteCustomer.mutate(confirmDelete.id) : deleteProperty.mutate(confirmDelete.id)} className="px-4 py-2 rounded-xl bg-red-700 text-white text-sm font-bold hover:bg-red-800">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
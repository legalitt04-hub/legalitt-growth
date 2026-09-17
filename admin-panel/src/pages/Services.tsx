import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Layers, Plus, Search, Edit2, Archive, LayoutGrid, List } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Modal } from '../components/ui/Modal';
import api from '../lib/api';

const formatCurrency = (val: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

export default function Services() {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [updateLoading, setUpdateLoading] = useState(false);

  const openCreateService = () => {
    setSelectedService({
      name: '', description: '', type: 'Other', category: 'General',
      basePrice: 0, estimatedDays: 1, isActive: true,
    });
    setIsModalOpen(true);
  };

  const fetchServices = async () => {
    try {
      const res = await api.get('/admin/services');
      if (res.data.success) {
        setServices(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching services', err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchServices();
  }, []);

  const handleUpdateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) return;
    setUpdateLoading(true);
    try {
      const payload = {
        name: selectedService.name,
        description: selectedService.description,
        type: selectedService.type,
        category: selectedService.category,
        basePrice: selectedService.basePrice,
        estimatedDays: selectedService.estimatedDays,
        isActive: selectedService.isActive
      };
      if (selectedService._id) await api.put(`/admin/services/${selectedService._id}`, payload);
      else await api.post('/admin/services', payload);
      setIsModalOpen(false);
      fetchServices();
    } catch (err) {
      alert(selectedService?._id ? 'Failed to update service' : 'Failed to create service');
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleToggleStatus = async (service: any) => {
    try {
      await api.put(`/admin/services/${service._id}`, { isActive: !service.isActive });
      fetchServices();
    } catch (err) {
      alert('Failed to toggle status');
    }
  };

  const filteredServices = services.filter(s => 
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.category?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-6 h-6 text-amber-500" />
            Service Management
          </h2>
          <p className="text-slate-500 text-sm mt-1">Configure and manage offerings, pricing, and availability.</p>
        </div>
        <button onClick={openCreateService} className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium text-sm transition-colors shadow-sm flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Service
        </button>
      </div>

      <Card className="bg-white border-slate-200 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search services..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-slate-50 border-slate-200 focus-visible:ring-amber-500 w-full"
            />
          </div>
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-amber-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-amber-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Card>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredServices.length === 0 ? (
            <div className="col-span-full p-8 text-center text-slate-500">No services found.</div>
          ) : (
            filteredServices.map(service => (
              <Card key={service._id} className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
                <div className="p-5 flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">
                      {service.category}
                    </Badge>
                    <div className={`w-2.5 h-2.5 rounded-full ${service.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} title={service.isActive ? 'Active' : 'Inactive'} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">{service.name}</h3>
                  <p className="text-2xl font-black text-amber-600 mb-4">{formatCurrency(service.basePrice)}</p>
                  <p className="text-sm text-slate-500 flex items-center gap-1.5">
                    <span className="font-semibold text-slate-700">{service.totalRequests || 0}</span> total requests
                  </p>
                </div>
                <div className="border-t border-slate-100 bg-slate-50 flex items-center p-2 divide-x divide-slate-200">
                  <button onClick={() => { setSelectedService(service); setIsModalOpen(true); }} className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium text-slate-600 hover:text-amber-600 transition-colors">
                    <Edit2 className="w-4 h-4" /> Edit
                  </button>
                  <button onClick={() => handleToggleStatus(service)} className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium text-slate-600 hover:text-red-600 transition-colors">
                    <Archive className="w-4 h-4" /> {service.isActive ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </Card>
            ))
          )}
        </div>
      ) : (
        <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                  <th className="p-4">Service Name</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Base Price</th>
                  <th className="p-4">Total Requests</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredServices.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-500">No services found.</td></tr>
                ) : (
                  filteredServices.map(service => (
                    <tr key={service._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 font-semibold text-slate-900">{service.name}</td>
                      <td className="p-4"><Badge variant="outline">{service.category}</Badge></td>
                      <td className="p-4 font-bold text-amber-600">{formatCurrency(service.basePrice)}</td>
                      <td className="p-4 text-slate-600">{service.totalRequests || 0}</td>
                      <td className="p-4">
                        {service.isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Inactive
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => { setSelectedService(service); setIsModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-amber-600 bg-white border border-slate-200 rounded-md shadow-sm transition-colors"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => handleToggleStatus(service)} className="p-1.5 text-slate-400 hover:text-red-600 bg-white border border-slate-200 rounded-md shadow-sm transition-colors"><Archive className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Service Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedService?._id ? 'Edit Service' : 'Add Service'}>
        {selectedService && (
          <form onSubmit={handleUpdateService} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Service Name</label>
              <Input 
                value={selectedService.name} 
                onChange={(e) => setSelectedService({ ...selectedService, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea value={selectedService.description || ''} onChange={(e) => setSelectedService({ ...selectedService, description: e.target.value })}
                required rows={3} className="w-full border border-slate-200 rounded-md p-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-500/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Service Type</label>
              <select value={selectedService.type || 'Other'} onChange={(e) => setSelectedService({ ...selectedService, type: e.target.value })}
                className="w-full bg-white border border-slate-200 text-slate-900 rounded-md p-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-500/50">
                {['Document', 'Consultation', 'Court Representation', 'Verification', 'Other'].map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <Input value={selectedService.category || ''} onChange={(e) => setSelectedService({ ...selectedService, category: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Estimated Days</label>
              <Input type="number" min="1" value={selectedService.estimatedDays || 1} onChange={(e) => setSelectedService({ ...selectedService, estimatedDays: Number(e.target.value) })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Base Price (₹)</label>
              <Input 
                type="number"
                value={selectedService.basePrice} 
                onChange={(e) => setSelectedService({ ...selectedService, basePrice: Number(e.target.value) })}
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="isActive"
                checked={selectedService.isActive}
                onChange={(e) => setSelectedService({ ...selectedService, isActive: e.target.checked })}
                className="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-500"
              />
              <label htmlFor="isActive" className="text-sm font-medium text-slate-700">Is Active</label>
            </div>
            <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
              <Button type="button" onClick={() => setIsModalOpen(false)} variant="outline" className="bg-white border-slate-200">
                Cancel
              </Button>
              <Button type="submit" disabled={updateLoading} className="bg-amber-500 hover:bg-amber-600 text-white">
                {updateLoading ? 'Saving...' : selectedService._id ? 'Save Changes' : 'Create Service'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </motion.div>
  );
}

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Modal } from '../components/ui/Modal';
import { Grid, Plus, Edit, Trash2, CheckCircle, Shield } from 'lucide-react';
import api from '../lib/api';

export default function Categories() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [basePrice, setBasePrice] = useState(0);

  const fetchCategories = async () => {
    try {
      const res = await api.get('/admin/categories');
      if (res.data?.success) {
        setCategories(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load categories', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleOpenAddModal = () => {
    setEditingCategory(null);
    setName('');
    setSlug('');
    setDescription('');
    setBasePrice(0);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (cat: any) => {
    setEditingCategory(cat);
    setName(cat.name);
    setSlug(cat.slug);
    setDescription(cat.description || '');
    setBasePrice(cat.basePrice ?? 0);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { name, slug: slug || name.toLowerCase().replace(/\s+/g, '-'), description, basePrice: Number(basePrice) };
      if (editingCategory) {
        await api.put(`/admin/categories/${editingCategory._id}`, payload);
      } else {
        await api.post('/admin/categories', payload);
      }
      setIsModalOpen(false);
      fetchCategories();
    } catch (err) {
      alert('Failed to save category');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this category?')) {
      try {
        await api.delete(`/admin/categories/${id}`);
        fetchCategories();
      } catch (err) {
        alert('Failed to delete category');
      }
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Grid className="w-6 h-6 text-amber-500" />
            Service Categories Management
          </h2>
          <p className="text-slate-500 text-sm mt-1">Manage core practice areas (Property, Criminal, Family, Cyber, Employment, Consumer Law) and consultation pricing.</p>
        </div>
        <Button onClick={handleOpenAddModal} className="bg-amber-500 hover:bg-amber-600 text-white">
          <Plus className="w-4 h-4 mr-2" /> Add Category
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full p-8 text-center text-slate-400">Loading categories...</div>
        ) : categories.map(cat => (
          <Card key={cat._id} className="p-5 bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-3">
                <span className="font-bold text-slate-900 text-lg">{cat.name}</span>
                <span className="text-sm font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">₹{cat.basePrice}</span>
              </div>
              <p className="text-xs text-slate-500 mb-4">{cat.description || 'Standard legal consultation practice area.'}</p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
              <span className="font-mono text-slate-400">/{cat.slug}</span>
              <div className="flex gap-2">
                <Button onClick={() => handleOpenEditModal(cat)} size="sm" variant="outline" className="border-slate-200">
                  <Edit className="w-3.5 h-3.5" />
                </Button>
                <Button onClick={() => handleDelete(cat._id)} size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Add / Edit Category Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingCategory ? 'Edit Category' : 'Add New Category'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Category Name</label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Property Law" className="bg-slate-50 border-slate-200" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">URL Slug</label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="e.g. property-law" className="bg-slate-50 border-slate-200" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Base Price (₹)</label>
            <Input type="number" required value={basePrice} onChange={(e) => setBasePrice(Number(e.target.value))} className="bg-slate-50 border-slate-200" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of legal services covered..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-md text-sm outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
            <Button type="button" onClick={() => setIsModalOpen(false)} variant="outline">Cancel</Button>
            <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-white">Save Category</Button>
          </div>
        </form>
      </Modal>
    </motion.div>
  );
}

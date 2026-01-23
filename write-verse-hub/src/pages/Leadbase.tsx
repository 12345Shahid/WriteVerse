import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useTeam } from '@/context/TeamContext';
import { SiteNav } from '@/components/SiteNav';
import { Button } from '@/components/ui/button-brutal';
import { Input } from '@/components/ui/input';
import { Download, Search, RefreshCw, Users, Mail, Calendar, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Lead {
  id: string;
  name: string | null;
  email: string;
  agent_id: string;
  agent_name?: string;
  created_at: string;
  session_count?: number;
}

export default function Leadbase() {
  const { currentTeam } = useTeam();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'name' | 'email' | 'created_at'>('created_at');
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    if (currentTeam) loadLeads();
  }, [currentTeam]);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Get leads from embed_leads table
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/leads`, {
        headers: {
          'x-user-id': session?.user?.id || '',
          'x-organization-id': currentTeam?.id || ''
        }
      });
      
      if (!res.ok) throw new Error('Failed to load leads');
      
      const data = await res.json();
      setLeads(data.leads || []);
    } catch (e) {
      console.error('Error loading leads:', e);
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (leads.length === 0) {
      toast.error('No leads to export');
      return;
    }

    const headers = ['Name', 'Email', 'Agent', 'Created At'];
    const csvData = leads.map(lead => [
      lead.name || 'N/A',
      lead.email,
      lead.agent_name || 'Unknown',
      new Date(lead.created_at).toLocaleDateString()
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success(`Exported ${leads.length} leads to CSV`);
  };

  // Filter and sort leads
  const filteredLeads = leads
    .filter(lead => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        (lead.name?.toLowerCase() || '').includes(term) ||
        lead.email.toLowerCase().includes(term)
      );
    })
    .sort((a, b) => {
      let valA = a[sortField] || '';
      let valB = b[sortField] || '';
      if (sortField === 'created_at') {
        valA = new Date(valA).getTime().toString();
        valB = new Date(valB).getTime().toString();
      }
      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });

  const toggleSort = (field: 'name' | 'email' | 'created_at') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteNav />
      
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6" />
              Leadbase
            </h1>
            <p className="text-gray-500 text-sm">View and export leads collected from your chat widgets</p>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadLeads} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={exportToCSV} disabled={leads.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border-2 border-black p-4 rounded-lg">
            <div className="text-sm text-gray-500 mb-1">Total Leads</div>
            <div className="text-3xl font-bold">{leads.length}</div>
          </div>
          <div className="bg-white border-2 border-black p-4 rounded-lg">
            <div className="text-sm text-gray-500 mb-1">With Names</div>
            <div className="text-3xl font-bold">{leads.filter(l => l.name).length}</div>
          </div>
          <div className="bg-white border-2 border-black p-4 rounded-lg">
            <div className="text-sm text-gray-500 mb-1">This Week</div>
            <div className="text-3xl font-bold">
              {leads.filter(l => {
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                return new Date(l.created_at) > weekAgo;
              }).length}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border-2 border-black rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              {searchTerm ? 'No leads match your search' : 'No leads collected yet'}
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-100 border-b-2 border-black">
                <tr>
                  <th 
                    className="text-left p-4 font-bold cursor-pointer hover:bg-gray-200"
                    onClick={() => toggleSort('name')}
                  >
                    <span className="flex items-center gap-1">
                      Name {sortField === 'name' && (sortAsc ? '↑' : '↓')}
                    </span>
                  </th>
                  <th 
                    className="text-left p-4 font-bold cursor-pointer hover:bg-gray-200"
                    onClick={() => toggleSort('email')}
                  >
                    <span className="flex items-center gap-1">
                      <Mail className="h-4 w-4" />
                      Email {sortField === 'email' && (sortAsc ? '↑' : '↓')}
                    </span>
                  </th>
                  <th className="text-left p-4 font-bold">Agent</th>
                  <th 
                    className="text-left p-4 font-bold cursor-pointer hover:bg-gray-200"
                    onClick={() => toggleSort('created_at')}
                  >
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Collected {sortField === 'created_at' && (sortAsc ? '↑' : '↓')}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead, i) => (
                  <tr key={lead.id} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}>
                    <td className="p-4">
                      <span className="font-medium">{lead.name || <span className="text-gray-400 italic">Not provided</span>}</span>
                    </td>
                    <td className="p-4">
                      <a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline">
                        {lead.email}
                      </a>
                    </td>
                    <td className="p-4 text-gray-600">{lead.agent_name || 'Unknown'}</td>
                    <td className="p-4 text-gray-500 text-sm">
                      {new Date(lead.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer Stats */}
        <div className="mt-4 text-sm text-gray-500 text-right">
          Showing {filteredLeads.length} of {leads.length} leads
        </div>
      </div>
    </div>
  );
}

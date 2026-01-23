import React, { useEffect, useState } from 'react';
import { SiteNav } from "@/components/SiteNav";
import { Bell, Check, AlertCircle, Info, Star, Calendar, MessageSquare } from "lucide-react";
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button-brutal';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'alert';
  read: boolean;
  created_at: string;
}

export default function Notifications() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        setUserId(userData.user?.id || null);

        if (userData.user?.id) {
          // Fetch notifications from database if table exists
          // For now, show sample notifications
          setNotifications([
            {
              id: '1',
              title: 'Welcome to WriteHub AI!',
              message: 'Start exploring our AI-powered writing tools to boost your productivity.',
              type: 'success',
              read: false,
              created_at: new Date().toISOString()
            },
            {
              id: '2', 
              title: 'New Feature: SEO Blog Studio',
              message: 'Create SEO-optimized blog posts with AI-powered keyword research and content generation.',
              type: 'info',
              read: false,
              created_at: new Date(Date.now() - 86400000).toISOString()
            },
            {
              id: '3',
              title: 'Your trial is active',
              message: 'You have access to all premium features during your trial period.',
              type: 'info',
              read: true,
              created_at: new Date(Date.now() - 172800000).toISOString()
            }
          ]);
        }
      } catch (err) {
        console.error('Error loading notifications:', err);
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <Check className="w-5 h-5 text-green-600" />;
      case 'warning': return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'alert': return <AlertCircle className="w-5 h-5 text-red-600" />;
      default: return <Info className="w-5 h-5 text-blue-600" />;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => 
      n.id === id ? { ...n, read: true } : n
    ));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteNav />
      
      <div className="container mx-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="bg-yellow-300 border-2 border-black p-2 rounded-lg shadow-brutal">
                <Bell className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-3xl font-black uppercase tracking-tight">Notifications</h1>
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="mt-1">{unreadCount} unread</Badge>
                )}
              </div>
            </div>
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={markAllAsRead}>
                <Check className="w-4 h-4 mr-2" />
                Mark all read
              </Button>
            )}
          </div>

          <div className="bg-white border-2 border-black shadow-brutal min-h-[500px]">
            {loading ? (
              <div className="p-8 text-center text-gray-500">
                <div className="animate-spin w-8 h-8 border-4 border-black border-t-transparent rounded-full mx-auto mb-4" />
                Loading notifications...
              </div>
            ) : !userId ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Please log in to view notifications.</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No notifications yet.</p>
              </div>
            ) : (
              <div className="divide-y-2 divide-black">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                      !notification.read ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${
                        notification.type === 'success' ? 'bg-green-100' :
                        notification.type === 'warning' ? 'bg-yellow-100' :
                        notification.type === 'alert' ? 'bg-red-100' : 'bg-blue-100'
                      }`}>
                        {getIcon(notification.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold">{notification.title}</h3>
                          {!notification.read && (
                            <span className="w-2 h-2 bg-blue-500 rounded-full" />
                          )}
                        </div>
                        <p className="text-gray-600 text-sm mt-1">{notification.message}</p>
                        <p className="text-gray-400 text-xs mt-2">{formatDate(notification.created_at)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

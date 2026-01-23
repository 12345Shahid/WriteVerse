import { useTeam } from '@/context/TeamContext';

/**
 * Hook for checking user permissions based on team role
 */
export function usePermissions() {
  const { currentTeam } = useTeam();
  
  const role = currentTeam?.role || 'viewer';
  const isViewer = role === 'viewer';
  const isEditor = role === 'editor';
  const isAdmin = role === 'admin';
  const isOwner = role === 'owner';
  
  // Permission levels
  const canView = true; // Everyone can view
  const canEdit = ['owner', 'admin', 'editor'].includes(role);
  const canManage = ['owner', 'admin'].includes(role);
  const canGenerate = !isViewer; // Viewers cannot generate content
  const canCreateContent = !isViewer;
  const canDeleteContent = canManage;
  
  return {
    role,
    isViewer,
    isEditor,
    isAdmin,
    isOwner,
    canView,
    canEdit,
    canManage,
    canGenerate,
    canCreateContent,
    canDeleteContent,
  };
}

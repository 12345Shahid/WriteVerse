import { ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { Lock } from 'lucide-react';

interface RestrictedFeatureProps {
  children: ReactNode;
  feature: 'generate' | 'edit' | 'delete' | 'create';
  message?: string;
  showWarning?: boolean;
}

/**
 * Wrapper component that restricts features based on user role
 * Blurs content and shows warning for viewers
 */
export function RestrictedFeature({ 
  children, 
  feature, 
  message,
  showWarning = true 
}: RestrictedFeatureProps) {
  const permissions = usePermissions();
  
  let isAllowed = true;
  let defaultMessage = '';
  
  switch (feature) {
    case 'generate':
      isAllowed = permissions.canGenerate;
      defaultMessage = 'Viewers cannot generate content';
      break;
    case 'create':
      isAllowed = permissions.canCreateContent;
      defaultMessage = 'Viewers cannot create new items';
      break;
    case 'edit':
      isAllowed = permissions.canEdit;
      defaultMessage = 'Viewers cannot edit content';
      break;
    case 'delete':
      isAllowed = permissions.canDeleteContent;
      defaultMessage = 'Only admins can delete content';
      break;
  }
  
  if (isAllowed) {
    return <>{children}</>;
  }
  
  return (
    <div className="relative">
      {showWarning && (
        <div className="bg-yellow-50 border-2 border-yellow-400 p-4 rounded-lg flex items-start gap-3 mb-4">
          <Lock className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-yellow-900">Access Restricted</p>
            <p className="text-sm text-yellow-700">{message || defaultMessage}</p>
          </div>
        </div>
      )}
      <div className="pointer-events-none opacity-50 blur-[2px]">
        {children}
      </div>
    </div>
  );
}

/**
 * WorkOS SSO Integration
 * 
 * Provides enterprise SSO (SAML/OIDC) for organizations.
 * 
 * Setup:
 * 1. Add WORKOS_API_KEY to .env
 * 2. Add WORKOS_CLIENT_ID to .env  
 * 3. Create connection in WorkOS dashboard
 * 
 * @see https://workos.com/docs/sso
 */
import 'dotenv/config';

// Feature flag
const WORKOS_ENABLED = !!(process.env.WORKOS_API_KEY && process.env.WORKOS_CLIENT_ID);

let workosClient = null;

/**
 * Initialize WorkOS client (lazy singleton)
 */
async function getWorkOS() {
    if (!WORKOS_ENABLED) {
        console.log('[WorkOS] Disabled - API keys not configured');
        return null;
    }

    if (workosClient) {
        return workosClient;
    }

    try {
        const { WorkOS } = await import('@workos-inc/node');
        workosClient = new WorkOS(process.env.WORKOS_API_KEY);
        console.log('[WorkOS] Client initialized');
        return workosClient;
    } catch (error) {
        console.error('[WorkOS] Failed to initialize:', error.message);
        return null;
    }
}

export function isWorkOSEnabled() {
    return WORKOS_ENABLED;
}

/**
 * Get SSO authorization URL
 * Redirects user to their identity provider (Okta, Azure AD, etc.)
 * 
 * @param organizationId - WorkOS organization ID (linked to WriterAI org)
 * @param redirectUri - Where to redirect after SSO
 */
export async function getSSOAuthorizationURL(organizationId, redirectUri) {
    const workos = await getWorkOS();
    if (!workos) {
        return { success: false, error: 'WorkOS not configured' };
    }

    try {
        console.log('[WorkOS][SSO] Generating auth URL for org:', organizationId);
        
        const authorizationURL = workos.sso.getAuthorizationUrl({
            clientId: process.env.WORKOS_CLIENT_ID,
            organization: organizationId,
            redirectUri: redirectUri || `${process.env.APP_URL || 'http://localhost:8080'}/auth/sso/callback`
        });

        console.log('[WorkOS][SSO] Auth URL generated');
        return { 
            success: true, 
            url: authorizationURL 
        };
    } catch (error) {
        console.error('[WorkOS][SSO] Error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Handle SSO callback - exchange code for user profile
 * 
 * @param code - Authorization code from callback
 */
export async function handleSSOCallback(code) {
    const workos = await getWorkOS();
    if (!workos) {
        return { success: false, error: 'WorkOS not configured' };
    }

    try {
        console.log('[WorkOS][SSO] Exchanging code for profile');
        
        const { profile, access_token } = await workos.sso.getProfileAndToken({
            clientId: process.env.WORKOS_CLIENT_ID,
            code: code
        });

        console.log('[WorkOS][SSO] Profile retrieved:', {
            email: profile.email,
            firstName: profile.first_name,
            idpId: profile.idp_id
        });

        return {
            success: true,
            profile: {
                email: profile.email,
                firstName: profile.first_name || '',
                lastName: profile.last_name || '',
                organizationId: profile.organization_id,
                idpId: profile.idp_id,
                connectionType: profile.connection_type,
                rawAttributes: profile.raw_attributes
            },
            accessToken: access_token
        };
    } catch (error) {
        console.error('[WorkOS][SSO] Callback error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Create a WorkOS organization (for enterprise onboarding)
 * 
 * @param name - Organization name
 * @param domains - Email domains for the organization
 */
export async function createWorkOSOrganization(name, domains = []) {
    const workos = await getWorkOS();
    if (!workos) {
        return { success: false, error: 'WorkOS not configured' };
    }

    try {
        console.log('[WorkOS][Org] Creating organization:', name);
        
        const organization = await workos.organizations.createOrganization({
            name,
            domains
        });

        console.log('[WorkOS][Org] Created:', organization.id);
        return { success: true, organization };
    } catch (error) {
        console.error('[WorkOS][Org] Error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Get SSO connection for an organization
 */
export async function getSSOConnection(organizationId) {
    const workos = await getWorkOS();
    if (!workos) {
        return { success: false, error: 'WorkOS not configured' };
    }

    try {
        const connections = await workos.sso.listConnections({
            organization: organizationId
        });

        return { 
            success: true, 
            connections: connections.data || [],
            hasSSO: connections.data?.length > 0
        };
    } catch (error) {
        console.error('[WorkOS][Connection] Error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Health check
 */
export async function healthCheck() {
    if (!WORKOS_ENABLED) {
        return { 
            status: 'disabled', 
            reason: 'WORKOS_API_KEY or WORKOS_CLIENT_ID not set',
            enabled: false 
        };
    }

    const workos = await getWorkOS();
    if (!workos) {
        return { 
            status: 'error', 
            reason: 'Failed to initialize client',
            enabled: true 
        };
    }

    return { 
        status: 'healthy', 
        enabled: true 
    };
}

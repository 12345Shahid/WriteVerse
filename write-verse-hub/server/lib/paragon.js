/**
 * Paragon Integration Service
 * 
 * Handles JWT token generation for Paragon frontend authentication.
 * Note: Paragon only has a frontend SDK (@useparagon/connect).
 * Backend just generates JWT tokens for user authentication.
 * 
 * IMPORTANT: Paragon uses RS256 algorithm with asymmetric keys
 */
import 'dotenv/config';

/**
 * Generate a JWT token for Paragon frontend authentication
 * @param userId - The user's ID from Supabase auth
 * @param metadata - Optional metadata to include in token
 */
export async function generateParagonToken(userId, metadata = {}) {
  if (!process.env.PARAGON_PROJECT_ID || !process.env.PARAGON_SIGNING_KEY) {
    throw new Error('Paragon credentials not configured');
  }

  // Use jsonwebtoken for signing
  const jwt = (await import('jsonwebtoken')).default;
  
  // IMPORTANT: Convert escaped newlines to actual newlines (for PEM format)
  // Paragon's signing key is a PEM private key that requires RS256
  let signingKey = process.env.PARAGON_SIGNING_KEY;
  signingKey = signingKey.replace(/\\n/g, '\n');
  
  // Ensure key ends with newline (PEM format requirement)
  if (!signingKey.endsWith('\n')) {
    signingKey = signingKey + '\n';
  }
  
  const token = jwt.sign(
    {
      sub: userId, // Paragon uses 'sub' for user ID
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiry
      ...metadata
    },
    signingKey,
    { algorithm: 'RS256' }  // Paragon uses RS256, not HS256
  );
  
  return token;
}

/**
 * Log content generation event (for analytics/debugging)
 * Note: Actual integration syncing happens via Paragon's frontend SDK
 * when user has integrations connected and configured
 */
export async function sendContentGeneratedEvent(userId, toolName, title, content, metadata = {}) {
  // Only log if Paragon is configured
  if (!process.env.PARAGON_PROJECT_ID) {
    return null;
  }

  console.log(`[Paragon] Content generated:`, {
    userId: userId?.substring(0, 8) + '...',
    tool: toolName,
    title: title?.substring(0, 50),
    length: content?.length,
  });
  
  return true;
}

/**
 * Log workflow step completed event
 */
export async function sendWorkflowStepEvent(userId, workflowId, stepNumber, toolName, output, metadata = {}) {
  if (!process.env.PARAGON_PROJECT_ID) {
    return null;
  }

  console.log(`[Paragon] Workflow step:`, {
    workflowId: workflowId?.substring(0, 8) + '...',
    step: stepNumber,
    tool: toolName,
  });
  
  return true;
}

/**
 * Log workflow completed event
 */
export async function sendWorkflowCompletedEvent(userId, workflowId, results, metadata = {}) {
  if (!process.env.PARAGON_PROJECT_ID) {
    return null;
  }

  console.log(`[Paragon] Workflow completed:`, {
    workflowId: workflowId?.substring(0, 8) + '...',
    stepCount: Object.keys(results || {}).length,
  });
  
  return true;
}

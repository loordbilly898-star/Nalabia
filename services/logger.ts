
interface LogDetails {
  userId?: string;
  email?: string;
  errorCode?: string;
  responseTime?: number;
  [key: string]: any;
}

export const logEvent = (type: 'auth' | 'api' | 'system', message: string, details: LogDetails = {}) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    type,
    message,
    ...details
  };

  // In production, you would send this to a service like Sentry or LogSnag
  // For now, we use structured console logs which can be monitored
  console.log(`[${type.toUpperCase()}] ${message}`, logEntry);

  // If there's an error, we mark it more clearly
  if (details.errorCode) {
    console.error(`[CRITICAL] Error in ${type}: ${message}`, details);
  }
};

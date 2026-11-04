const configuredUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export const API_BASE_URL = configuredUrl.replace(/\/$/, '');

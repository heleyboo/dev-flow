import { logger } from './logger.js';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

export async function apiRequest(url, options = {}) {
  const { retries = MAX_RETRIES, ...fetchOptions } = options;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, fetchOptions);

      if (response.status === 429 && attempt < retries) {
        const delay = RETRY_DELAY * Math.pow(2, attempt - 1);
        logger.warn(`Rate limited. Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      return response;
    } catch (error) {
      if (attempt === retries) throw error;
      const delay = RETRY_DELAY * attempt;
      logger.warn(`Request failed. Retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

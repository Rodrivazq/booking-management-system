import fetch from 'node-fetch';
import { TURNSTILE_SECRET_KEY } from '../config/env';
import logger from './logger';

export const verifyTurnstileToken = async (token: string, ip: string): Promise<boolean> => {
    if (!TURNSTILE_SECRET_KEY) {
        // Fallback to true if Turnstile is disabled/unconfigured via env vars.
        return true; 
    }

    if (!token) {
        return false;
    }

    try {
        const formData = new URLSearchParams();
        formData.append('secret', TURNSTILE_SECRET_KEY);
        formData.append('response', token);
        formData.append('remoteip', ip);

        const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            body: formData,
            method: 'POST',
        });

        const outcome = await result.json() as any;
        
        if (outcome.success) {
            return true;
        }

        logger.warn(`Turnstile validation failed: ${JSON.stringify(outcome['error-codes'])} for IP ${ip}`);
        return false;

    } catch (e) {
        logger.error(`Error validating Turnstile token: ${e}`);
        return false;
    }
};

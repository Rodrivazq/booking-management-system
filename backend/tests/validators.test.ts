import { describe, it, expect } from 'vitest';
import { validateImageUrl } from '../src/utils/validators';

describe('validateImageUrl', () => {
    it('allows empty, null or undefined', () => {
        expect(validateImageUrl('')).toBe(true);
        expect(validateImageUrl(null)).toBe(true);
        expect(validateImageUrl(undefined)).toBe(true);
    });

    it('rejects long URLs over 500 characters', () => {
        const longUrl = 'https://example.com/' + 'a'.repeat(500);
        expect(validateImageUrl(longUrl)).toBe(false);
    });

    it('rejects data URLs strictly', () => {
        expect(validateImageUrl('data:image/png;base64,iVBORw0KGgo...')).toBe(false);
        expect(validateImageUrl(' DATA:IMAGE/JPEG;BASE64,xyz ')).toBe(false);
    });

    it('rejects protocol-relative URLs (//)', () => {
        expect(validateImageUrl('//evil.com/avatar.jpg')).toBe(false);
    });

    it('allows valid internal relative paths', () => {
        expect(validateImageUrl('/images/avatar.jpg')).toBe(true);
        expect(validateImageUrl('/assets/logo.png')).toBe(true);
        expect(validateImageUrl('/uploads/pic.jpg')).toBe(true);
        expect(validateImageUrl('/default-avatar.png')).toBe(true);
    });

    it('rejects invalid internal relative paths', () => {
        expect(validateImageUrl('/etc/passwd')).toBe(false);
        expect(validateImageUrl('/some-unknown/path.jpg')).toBe(false);
    });

    it('rejects plain http or weird protocols', () => {
        expect(validateImageUrl('http://example.com/avatar.jpg')).toBe(false);
        expect(validateImageUrl('ftp://example.com/avatar.jpg')).toBe(false);
        expect(validateImageUrl('javascript:alert(1)')).toBe(false);
    });
});

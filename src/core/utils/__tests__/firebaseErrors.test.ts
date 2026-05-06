import { describe, it, expect } from 'vitest';
import { isFunctionsDeadlineExceeded } from '../firebaseErrors';

describe('isFunctionsDeadlineExceeded', () => {
    it('matches Firebase callable error with code "functions/deadline-exceeded"', () => {
        const err = Object.assign(new Error('deadline-exceeded'), { code: 'functions/deadline-exceeded' });
        expect(isFunctionsDeadlineExceeded(err)).toBe(true);
    });

    it('matches plain object with code "functions/deadline-exceeded"', () => {
        expect(isFunctionsDeadlineExceeded({ code: 'functions/deadline-exceeded' })).toBe(true);
    });

    it('matches Error whose message is "deadline-exceeded" without an explicit code', () => {
        expect(isFunctionsDeadlineExceeded(new Error('deadline-exceeded'))).toBe(true);
    });

    it('does NOT match other Firebase Functions error codes', () => {
        expect(isFunctionsDeadlineExceeded({ code: 'functions/unauthenticated' })).toBe(false);
        expect(isFunctionsDeadlineExceeded({ code: 'functions/internal' })).toBe(false);
    });

    it('does NOT match generic errors', () => {
        expect(isFunctionsDeadlineExceeded(new Error('Network error'))).toBe(false);
        expect(isFunctionsDeadlineExceeded(new Error('Channel not found'))).toBe(false);
    });

    it('handles null, undefined, primitives, and missing fields', () => {
        expect(isFunctionsDeadlineExceeded(null)).toBe(false);
        expect(isFunctionsDeadlineExceeded(undefined)).toBe(false);
        expect(isFunctionsDeadlineExceeded('deadline-exceeded')).toBe(false);
        expect(isFunctionsDeadlineExceeded(42)).toBe(false);
        expect(isFunctionsDeadlineExceeded({})).toBe(false);
    });
});

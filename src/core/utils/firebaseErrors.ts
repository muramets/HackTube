/**
 * Narrows an unknown error from a Firebase Functions httpsCallable invocation
 * to detect a client-side deadline-exceeded — which means the client gave up
 * waiting, NOT that the server function failed. Use this to suppress misleading
 * error toasts when the function is configured with a longer server-side timeout
 * and the UI updates via a Firestore subscription anyway.
 */
export const isFunctionsDeadlineExceeded = (err: unknown): boolean => {
    if (!err || typeof err !== 'object') return false;
    const code = (err as { code?: unknown }).code;
    if (typeof code === 'string' && code === 'functions/deadline-exceeded') return true;
    const message = (err as { message?: unknown }).message;
    return typeof message === 'string' && message === 'deadline-exceeded';
};

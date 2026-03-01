/* eslint-disable @typescript-eslint/no-explicit-any */
import '@testing-library/jest-dom'

// Mock matchMedia for jsdom
if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation((query) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: jest.fn(),
            removeListener: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
        })),
    });

    Object.defineProperty(window, 'speechSynthesis', {
        writable: true,
        value: {
            speak: jest.fn(),
            cancel: jest.fn(),
            getVoices: jest.fn().mockReturnValue([]),
            pause: jest.fn(),
            resume: jest.fn(),
        }
    });

    (window as any).SpeechSynthesisUtterance = jest.fn();
}

// Mock Notification API
(global as any).Notification = {
    requestPermission: jest.fn().mockResolvedValue('granted'),
    permission: 'granted'
};

// Mock navigator.serviceWorker
if (typeof navigator !== 'undefined') {
    // @ts-expect-error - navigator.serviceWorker is read-only in some environments
    global.navigator.serviceWorker = {
        register: jest.fn().mockImplementation(() => Promise.resolve({ scope: 'mock-scope' })),
        ready: Promise.resolve({
            showNotification: jest.fn()
        })
    } as any;
}

// Global mocks for common animation/heavy libs
jest.mock('framer-motion', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ReactInner = require('react');
    return {
        motion: new Proxy({}, {
            get: (_target, key) => {
                return (props: any) => ReactInner.createElement(key, props);
            }
        }),
        AnimatePresence: ({ children }: any) => children,
    };
});

jest.mock('next/dynamic', () => () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ReactInner = require('react');
    const MockComponent = () => ReactInner.createElement('div', { 'data-testid': 'dynamic-mock' });
    return MockComponent;
});

jest.mock('html2canvas', () => jest.fn());

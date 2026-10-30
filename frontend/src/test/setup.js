import '@testing-library/jest-dom';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock window.scrollTo
window.scrollTo = () => {};

// Mock Element.prototype.scrollIntoView
Element.prototype.scrollIntoView = () => {};

// Mock navigator.clipboard
if (!navigator.clipboard) {
  navigator.clipboard = {
    writeText: async () => {},
    readText: async () => '',
  };
}


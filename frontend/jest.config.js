/** @type {import('ts-jest').JestConfigWithTsJest} **/
export default {
  preset: 'ts-jest',
  testEnvironment: "jest-environment-jsdom",
  transform: {
    "^.+.tsx?$": ["ts-jest", {}],
  },
  // allow jest to handle certain import types e.g. aliases, css, ..., etc 
  moduleNameMapper: {
    // mock css modules
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    // todo:
    // Maps custom path aliases (if you use them in Vite) to their actual locations in the project.
    '^@/(.*)$': '<rootDir>/src/$1', // Adjust based on your Vite alias configuration.
  },

  // Lists the file extensions Jest will recognize when importing modules.
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx'],


  // such as adding global imports or extending Jest matchers.
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'], // Optional; can include setup for libraries like React Testing Library.

};
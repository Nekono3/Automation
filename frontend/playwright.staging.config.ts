import {defineConfig} from '@playwright/test';
export default defineConfig({
  globalSetup:'./tests/staging/global-setup.ts',testDir:'./tests/staging',outputDir:'./test-results-staging',workers:1,fullyParallel:false,reporter:'list',timeout:30000,
  use:{baseURL:'https://localhost:8443',ignoreHTTPSErrors:true,headless:true,trace:'off',
    launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {}},
});

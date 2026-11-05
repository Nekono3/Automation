import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests',testMatch:'**/*.spec.ts',fullyParallel:false,workers:1,reporter:'list',
  testIgnore:'**/staging/**',
  use:{baseURL:'http://127.0.0.1:3100',headless:true,launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {}},
  webServer:{command:'node node_modules/next/dist/bin/next start -p 3100 -H 127.0.0.1',url:'http://127.0.0.1:3100',reuseExistingServer:false},
});

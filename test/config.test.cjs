const assert = require('node:assert/strict');
const {test} = require('node:test');
const {execFileSync} = require('node:child_process');
const path = require('node:path');

test('Fastlane environment cannot override Expo-owned release values', () => {
  const readConfig = overrides =>
    JSON.parse(
      execFileSync(
        process.execPath,
        [
          '-e',
          "console.log(JSON.stringify(require('./app.config.ts').default))",
        ],
        {
          cwd: path.join(__dirname, '..'),
          env: {...process.env, ...overrides},
          encoding: 'utf8',
        },
      ),
    );

  assert.deepEqual(
    readConfig({
      APP_VERSION: '9.9.9',
      BUILD_NUMBER: '999',
      IOS_BUNDLE_IDENTIFIER: 'com.wrong.ios',
      ANDROID_PACKAGE_NAME: 'com.wrong.android',
    }),
    readConfig({}),
  );
});

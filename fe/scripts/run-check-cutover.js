const { execSync } = require('child_process');
const fs = require('fs');

const OUT = 'C:\\Users\\dangq\\OneDrive\\Documents\\GitHub\\Full-Stack-E-commerce\\fe\\scripts\\check-output.txt';
const lines = [];

function log(msg) {
  lines.push(msg);
}

// Write marker immediately
fs.writeFileSync(OUT, 'START\n', 'utf8');

process.chdir('C:\\Users\\dangq\\OneDrive\\Documents\\GitHub\\Full-Stack-E-commerce');

log('=== GIT STATUS FOR TARGET FILES ===');
const files = [
  'fe/scripts/migrate-icons.mjs',
  'fe/src/app/pages/Root.tsx',
  'fe/src/app/pages/seller/SellerPage.tsx',
  'fe/src/app/pages/admin/AdminPage.tsx',
  'fe/src/app/components/form-dialog.tsx',
  'fe/src/app/components/form-dialog.test.tsx',
  'fe/src/app/components/image-with-fallback.tsx',
  'fe/src/app/components/image-with-fallback.test.tsx',
  'fe/src/app/components/seller-product-modal.tsx',
  'fe/src/app/components/seller-product-modal.test.tsx',
];

for (const f of files) {
  try {
    execSync('git ls-files --error-unmatch "' + f + '"', { encoding: 'utf8', stdio: 'pipe' });
    log('IN_INDEX: ' + f);
  } catch (e) {
    if (e.status === 1) {
      log('NOT_IN_INDEX: ' + f);
    } else {
      log('ERROR(' + e.status + '): ' + f + ' — ' + (e.stderr || ''));
    }
  }
}

log('');
log('=== CURRENT COMMIT ===');
try {
  const head = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  log('HEAD: ' + head);
} catch(e) {
  log('git rev-parse HEAD failed: ' + e.message);
}

log('');
log('=== RUNNING check-cutover.test.mjs ===');
let exitCode = 0;
let stdout = '';
let stderr = '';
try {
  stdout = execSync('node fe/scripts/check-cutover.test.mjs', { encoding: 'utf8', timeout: 60000, cwd: 'C:\\Users\\dangq\\OneDrive\\Documents\\GitHub\\Full-Stack-E-commerce' });
  log('STDOUT: ' + stdout);
} catch(e) {
  exitCode = e.status || -1;
  stdout = e.stdout || '';
  stderr = e.stderr || '';
  log('EXIT_CODE: ' + exitCode);
  log('STDOUT: ' + stdout);
  log('STDERR: ' + stderr);
}

fs.writeFileSync(OUT, lines.join('\n'), 'utf8');

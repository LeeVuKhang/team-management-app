// Generate self-signed SSL certificates for localhost
// Run with: node generate-certs.mjs

import selfsigned from 'selfsigned';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const certsDir = path.join(__dirname, 'certs');

// Ensure certs directory exists
if (!fs.existsSync(certsDir)) {
    fs.mkdirSync(certsDir);
}

const keyPath = path.join(certsDir, 'localhost-key.pem');
const certPath = path.join(certsDir, 'localhost-cert.pem');

// Check if certificates already exist
if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    console.log('✅ Certificates already exist!');
    console.log(`   Key:  ${keyPath}`);
    console.log(`   Cert: ${certPath}`);
    process.exit(0);
}

console.log('🔐 Generating self-signed SSL certificates...\n');

// Generate certificate for localhost using callback API
const attrs = [{ name: 'commonName', value: 'localhost' }];

selfsigned.generate(attrs, {
    algorithm: 'sha256',
    days: 365,
    keySize: 2048,
    extensions: [
        { name: 'basicConstraints', cA: true },
        {
            name: 'subjectAltName',
            altNames: [
                { type: 2, value: 'localhost' },
                { type: 7, ip: '127.0.0.1' }
            ]
        }
    ]
}, (err, pems) => {
    if (err) {
        console.error('❌ Error generating certificates:', err);
        process.exit(1);
    }

    // Save private key
    fs.writeFileSync(keyPath, pems.private);
    console.log(`✅ Private key saved: ${keyPath}`);

    // Save certificate
    fs.writeFileSync(certPath, pems.cert);
    console.log(`✅ Certificate saved: ${certPath}`);

    console.log('\n🎉 SSL certificates generated successfully!');
    console.log('\n📝 Note: Browser will show "Not Secure" warning for self-signed certs.');
    console.log('   This is normal for local development.');
});

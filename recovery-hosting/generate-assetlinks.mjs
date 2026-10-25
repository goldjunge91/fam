const packageName = 'com.goldjunge91.fam';
const fingerprints = (process.env.ANDROID_SIGNING_CERT_SHA256 ?? '')
  .split(',')
  .map((fingerprint) => fingerprint.trim().toUpperCase())
  .filter(Boolean);

if (fingerprints.length === 0) {
  throw new Error(
    'Set ANDROID_SIGNING_CERT_SHA256 to the real Play App Signing SHA-256 fingerprint before generating assetlinks.json.',
  );
}

const normalizedFingerprints = fingerprints.map((fingerprint) => {
  const hex = fingerprint.replaceAll(':', '');
  if (!/^[0-9A-F]{64}$/.test(hex)) {
    throw new Error('Each Android signing fingerprint must contain exactly 32 hexadecimal bytes.');
  }
  return hex.match(/.{2}/g)?.join(':') ?? '';
});

const statement = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: packageName,
      sha256_cert_fingerprints: normalizedFingerprints,
    },
  },
];

process.stdout.write(`${JSON.stringify(statement, null, 2)}\n`);

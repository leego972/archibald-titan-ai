# Code Signing Guide for Archibald Titan

Code signing is required to eliminate security warnings on Windows and macOS, and is **mandatory** for macOS auto-updates to work.

## Why Code Signing Matters

- **Windows**: Without signing, SmartScreen shows "Windows protected your PC" warning. Users must click "More info" → "Run anyway" to proceed.
- **macOS**: Without signing, Gatekeeper blocks the app entirely. Users must go to System Preferences → Security to allow it. Auto-updates via `electron-updater` **will not work** without code signing on macOS.
- **Linux**: No code signing required. AppImage works without signing.

---

## Windows Code Signing

### Option 1: EV Code Signing Certificate (Recommended)

EV (Extended Validation) certificates provide immediate SmartScreen reputation — no warning from day one.

1. **Purchase an EV code signing certificate** from a trusted CA:
   - DigiCert (~$500/year)
   - Sectigo/Comodo (~$300/year)
   - GlobalSign (~$400/year)

2. **The certificate comes on a hardware token** (USB dongle). You need physical access to sign.

3. **Configure electron-builder** in `package.json`:
   ```json
   "win": {
     "certificateSubjectName": "Your Company Name",
     "signingHashAlgorithms": ["sha256"]
   }
   ```

4. **Set environment variables** before building:
   ```bash
   export CSC_LINK=/path/to/certificate.pfx
   export CSC_KEY_PASSWORD=your-password
   ```

### Option 2: OV Code Signing Certificate

OV (Organization Validation) is cheaper but requires building SmartScreen reputation over time.

- Same setup as EV, but expect SmartScreen warnings for the first ~1000 downloads.

### Option 3: Self-Signed (Development Only)

Not recommended for distribution. Only use for local testing.

---

## macOS Code Signing

### Requirements

1. **Apple Developer Account** ($99/year at https://developer.apple.com)
2. **Developer ID Application certificate** (for distribution outside the App Store)
3. **Notarization** (required since macOS 10.15 Catalina)

### Setup

1. **Create a Developer ID Application certificate** in Apple Developer portal → Certificates, Identifiers & Profiles

2. **Install the certificate** in your macOS Keychain

3. **Configure electron-builder** in `package.json`:
   ```json
   "mac": {
     "identity": "Developer ID Application: Your Name (TEAM_ID)",
     "hardenedRuntime": true,
     "gatekeeperAssess": false,
     "entitlements": "build/entitlements.mac.plist",
     "entitlementsInherit": "build/entitlements.mac.plist"
   },
   "afterSign": "scripts/notarize.js"
   ```

4. **Create entitlements file** at `build/entitlements.mac.plist`:
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
     <dict>
       <key>com.apple.security.cs.allow-jit</key>
       <true/>
       <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
       <true/>
     </dict>
   </plist>
   ```

5. **Create notarization script** at `scripts/notarize.js`:
   ```js
   const { notarize } = require("@electron/notarize");
   
   exports.default = async function notarizing(context) {
     const { electronPlatformName, appOutDir } = context;
     if (electronPlatformName !== "darwin") return;
     
     const appName = context.packager.appInfo.productFilename;
     return await notarize({
       appBundleId: "com.archibald.titan",
       appPath: `${appOutDir}/${appName}.app`,
       appleId: process.env.APPLE_ID,
       appleIdPassword: process.env.APPLE_ID_PASSWORD,
       teamId: process.env.APPLE_TEAM_ID,
     });
   };
   ```

6. **Set environment variables**:
   ```bash
   export APPLE_ID=your@email.com
   export APPLE_ID_PASSWORD=app-specific-password
   export APPLE_TEAM_ID=YOUR_TEAM_ID
   ```

### Important Notes for macOS Auto-Updates

- The macOS target must be changed from `zip` to `dmg` for auto-updates to work properly with electron-updater
- Update `package.json` build config:
  ```json
  "mac": {
    "target": ["dmg", "zip"]
  }
  ```
- The `latest-mac.yml` file is generated automatically during the build

---

## CI/CD Integration

For automated builds with signing, use GitHub Actions:

```yaml
# .github/workflows/build.yml
name: Build & Release
on:
  push:
    tags: ['v*']

jobs:
  build:
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: cd electron && npm install
      - name: Build
        env:
          CSC_LINK: ${{ secrets.CSC_LINK }}
          CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_ID_PASSWORD: ${{ secrets.APPLE_ID_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        run: cd electron && npm run build:all
```

---

## Quick Start (No Signing)

If you want to distribute without signing for now:

1. **Windows**: Users will see SmartScreen warning but can click through
2. **macOS**: Users must right-click → Open → Open to bypass Gatekeeper
3. **Linux**: No issues, AppImage works without signing

The auto-updater will still work on **Windows and Linux** without code signing. Only macOS requires signing for auto-updates.

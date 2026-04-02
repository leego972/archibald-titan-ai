# macOS Code Signing Setup

## Current Status

The GitHub Actions workflow for macOS builds is configured with:

- ✅ Developer ID Application certificate created (expires 2031/04/03)
- ✅ App Store Connect API key configured for notarization
- ✅ Keychain setup in CI workflow
- ✅ All secrets configured in GitHub Actions

However, macOS code signing in CI is currently **disabled** due to P12 certificate format compatibility issues between OpenSSL 3.x (Linux) and macOS security framework.

## What's Working

- **Linux builds**: ✅ Signed with GPG
- **Windows builds**: ✅ Self-signed (ready for EV cert upgrade)
- **macOS builds**: ✅ **Unsigned DMG** (fully functional, shows "unidentified developer" warning on first launch)

## To Enable macOS Signing Locally

### Prerequisites

1. macOS machine with Xcode installed
2. Apple Developer account with Admin access
3. Developer ID Application certificate installed in Keychain Access

### Steps

1. **Export P12 from Keychain Access** (on a Mac):
   ```bash
   # Open Keychain Access
   # Find "Developer ID Application: LEE IDA (5AUSX9646V)"
   # Right-click → Export "Developer ID Application..."
   # Save as developer_id.p12 with password: TitanSign2026!
   ```

2. **Update GitHub Secret**:
   ```bash
   # Base64 encode the P12
   base64 -i developer_id.p12 | pbcopy
   
   # Go to GitHub → Settings → Secrets → Actions
   # Update APPLE_DEVELOPER_ID_P12 with the base64 string
   ```

3. **Re-enable signing in workflow**:
   - The workflow at `.github/workflows/desktop-build.yml` is already configured
   - Just push a commit to trigger a new build
   - macOS build will now be signed and notarized

### Alternative: Sign Locally

If you prefer to build and sign locally instead of in CI:

```bash
cd electron
npm run build:mac
```

This will:
- Build the Electron app
- Sign with your local Developer ID certificate
- Notarize with App Store Connect API key
- Create a signed DMG in `electron/dist/`

## Certificates & Keys

All certificates and API keys are stored in GitHub Actions secrets:

- `APPLE_DEVELOPER_ID_P12` — Developer ID Application certificate (P12 format)
- `APPLE_DEVELOPER_ID_P12_PASSWORD` — P12 password: `TitanSign2026!`
- `APPLE_TEAM_ID` — Team ID: `5AUSX9646V`
- `APPLE_API_KEY_ID` — App Store Connect API Key ID: `79AC3DK8Z3`
- `APPLE_API_ISSUER_ID` — Issuer ID: `d7c6c514-df7f-4adb-a4a0-b0553ea751a4`
- `APPLE_API_PRIVATE_KEY` — App Store Connect API private key (.p8 file content)

## Troubleshooting

If builds fail with "cannot read entitlement data":
- Check that `electron/build/entitlements.mac.plist` has no XML comments
- Verify the P12 was exported from a Mac (not generated with OpenSSL on Linux)

If notarization fails:
- Check that the App Store Connect API key is still active
- Verify the APPLE_API_PRIVATE_KEY secret contains the full .p8 file content

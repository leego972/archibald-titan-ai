/**
 * macOS Notarization Script
 * 
 * This script is called by electron-builder after signing the macOS app.
 * It submits the app to Apple's notarization service, which is required
 * for distribution outside the Mac App Store on macOS 10.15+.
 * 
 * Required environment variables:
 *   APPLE_API_KEY_ID        - App Store Connect API Key ID (10 chars)
 *   APPLE_API_ISSUER_ID     - App Store Connect API Issuer ID (UUID)
 *   APPLE_API_PRIVATE_KEY   - App Store Connect API Private Key (.p8 file content)
 *   APPLE_TEAM_ID           - Your Apple Developer Team ID (10-char alphanumeric)
 * 
 * These should be set as GitHub Actions secrets.
 */

const { notarize } = require("@electron/notarize");
const fs = require("fs");
const path = require("path");
const os = require("os");

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  // Only notarize on macOS builds
  if (electronPlatformName !== "darwin") {
    return;
  }

  // Skip if no Apple credentials are set (e.g. local builds without signing)
  if (!process.env.APPLE_API_KEY_ID || !process.env.APPLE_API_ISSUER_ID || !process.env.APPLE_API_PRIVATE_KEY || !process.env.APPLE_TEAM_ID) {
    console.log("Skipping notarization: APPLE_API_KEY_ID / APPLE_API_ISSUER_ID / APPLE_API_PRIVATE_KEY / APPLE_TEAM_ID not set.");
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  console.log(`Notarizing ${appPath}...`);

  // Write the API key to a temporary file
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "apple-api-key-"));
  const apiKeyPath = path.join(tmpDir, `AuthKey_${process.env.APPLE_API_KEY_ID}.p8`);
  fs.writeFileSync(apiKeyPath, process.env.APPLE_API_PRIVATE_KEY);

  try {
    await notarize({
      appBundleId: "com.archibald.titan",
      appPath,
      appleApiKey: apiKeyPath,
      appleApiKeyId: process.env.APPLE_API_KEY_ID,
      appleApiIssuer: process.env.APPLE_API_ISSUER_ID,
      teamId: process.env.APPLE_TEAM_ID,
    });
    console.log("Notarization complete.");
  } catch (err) {
    console.error("Notarization failed:", err.message);
    // Fail the build if notarization fails — don't ship unsigned builds
    throw err;
  } finally {
    // Clean up the temporary API key file
    try {
      fs.unlinkSync(apiKeyPath);
      fs.rmdirSync(tmpDir);
    } catch (cleanupErr) {
      console.warn("Failed to clean up temporary API key file:", cleanupErr.message);
    }
  }
};

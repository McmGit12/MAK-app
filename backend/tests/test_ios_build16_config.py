"""
iOS Build 16 (v1.0.15) Config Verification
Verifies the two App-Store-readiness fixes:
  Fix 1: Unused microphone permission removed (expo-camera & expo-image-picker)
  Fix 2: iPad locked to portrait (ios.requireFullScreen)
Runs `npx expo config --type introspect --json` and asserts the final Info.plist / Android permissions.
"""
import json
import os
import subprocess
import pytest


@pytest.fixture(scope="module")
def introspect():
    """Run `npx expo config --type introspect --json` once for this module."""
    frontend = "/app/frontend"
    result = subprocess.run(
        ["npx", "expo", "config", "--type", "introspect", "--json"],
        cwd=frontend, capture_output=True, text=True, timeout=120,
    )
    assert result.returncode == 0, f"expo config failed:\nstdout={result.stdout[-500:]}\nstderr={result.stderr[-500:]}"
    return json.loads(result.stdout)


class TestMicrophoneRemoval:
    """Fix 1: microphone permission MUST be absent (iOS & Android)."""

    def test_ios_no_microphone_usage_description(self, introspect):
        info = introspect["ios"]["infoPlist"]
        assert "NSMicrophoneUsageDescription" not in info, \
            f"NSMicrophoneUsageDescription must NOT be present, got={info.get('NSMicrophoneUsageDescription')}"

    def test_ios_camera_usage_description_present_and_specific(self, introspect):
        info = introspect["ios"]["infoPlist"]
        v = info.get("NSCameraUsageDescription", "")
        assert v, "NSCameraUsageDescription missing"
        # non-generic: mentions skin analysis or MAK context
        assert any(word in v.lower() for word in ("skin", "mak", "analysis", "selfie")), \
            f"NSCameraUsageDescription too generic: {v}"

    def test_ios_photo_library_usage_description_present_and_specific(self, introspect):
        info = introspect["ios"]["infoPlist"]
        v = info.get("NSPhotoLibraryUsageDescription", "")
        assert v, "NSPhotoLibraryUsageDescription missing"
        assert any(word in v.lower() for word in ("skin", "mak", "photo", "analysis")), \
            f"NSPhotoLibraryUsageDescription too generic: {v}"

    def test_android_no_record_audio(self, introspect):
        perms = introspect["android"].get("permissions", [])
        assert "android.permission.RECORD_AUDIO" not in perms, \
            f"RECORD_AUDIO must be absent, got={perms}"

    def test_android_has_camera(self, introspect):
        perms = introspect["android"].get("permissions", [])
        assert "android.permission.CAMERA" in perms, f"CAMERA missing, got={perms}"


class TestIPadPortraitLock:
    """Fix 2: iPad locked to portrait via UIRequiresFullScreen + orientation list."""

    def test_ios_require_full_screen_true(self, introspect):
        info = introspect["ios"]["infoPlist"]
        assert info.get("UIRequiresFullScreen") is True, \
            f"UIRequiresFullScreen must be True, got={info.get('UIRequiresFullScreen')}"

    def test_ios_supports_tablet_true(self, introspect):
        assert introspect["ios"].get("supportsTablet") is True

    def test_ios_orientation_portrait_only(self, introspect):
        info = introspect["ios"]["infoPlist"]
        orient = info.get("UISupportedInterfaceOrientations", [])
        assert set(orient) == {
            "UIInterfaceOrientationPortrait",
            "UIInterfaceOrientationPortraitUpsideDown",
        }, f"Expected portrait only, got={orient}"

    def test_ios_no_ipad_landscape_override(self, introspect):
        info = introspect["ios"]["infoPlist"]
        assert "UISupportedInterfaceOrientations~ipad" not in info, \
            f"iPad orientation override present: {info.get('UISupportedInterfaceOrientations~ipad')}"


class TestVersionAndEncryption:
    """Assert version 1.0.15 build 16, Android versionCode 116, encryption exempt."""

    def test_ios_short_version(self, introspect):
        assert introspect["ios"]["infoPlist"].get("CFBundleShortVersionString") == "1.0.15"

    def test_ios_build_number(self, introspect):
        assert introspect["ios"]["infoPlist"].get("CFBundleVersion") == "16"
        assert introspect["ios"].get("buildNumber") == "16"

    def test_ios_encryption_exempt(self, introspect):
        assert introspect["ios"]["infoPlist"].get("ITSAppUsesNonExemptEncryption") is False

    def test_android_version_code(self, introspect):
        assert introspect["android"].get("versionCode") == 116

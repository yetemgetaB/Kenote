#!/usr/bin/env bash
set -e

# Kenote Universal Linux Installer
# Supports Fedora/RHEL (.rpm), Debian/Ubuntu (.deb), and generic distros (.AppImage)

REPO="yetemgetaB/Kenote"
APP_NAME="kenote"
DISPLAY_NAME="Kenote"

echo "========================================="
echo "       Installing $DISPLAY_NAME           "
echo "========================================="

# 1. Detect architecture
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64)
    ARCH_FILTER="x86_64|amd64"
    ;;
  aarch64|arm64)
    ARCH_FILTER="aarch64|arm64"
    ;;
  *)
    echo "❌ Unsupported architecture: $ARCH"
    exit 1
    ;;
esac

# 2. Check for required curl or wget
if command -v curl >/dev/null 2>&1; then
  FETCH="curl -fsSL"
elif command -v wget >/dev/null 2>&1; then
  FETCH="wget -qO-"
else
  echo "❌ Error: Neither curl nor wget was found. Please install one of them to proceed."
  exit 1
fi

echo "🔍 Fetching latest release info for $REPO..."
RELEASE_JSON=$($FETCH "https://api.github.com/repos/$REPO/releases/latest" 2>/dev/null)

if [ -z "$RELEASE_JSON" ] || echo "$RELEASE_JSON" | grep -q '"message": "Not Found"'; then
  echo "❌ Failed to fetch release metadata from GitHub. Please check your internet connection."
  exit 1
fi

LATEST_TAG=$(echo "$RELEASE_JSON" | grep '"tag_name":' | head -n1 | sed -E 's/.*"([^"]+)".*/\1/')
echo "📦 Latest version detected: $LATEST_TAG"

# Helper to find asset URL matching pattern
get_asset_url() {
  local ext="$1"
  echo "$RELEASE_JSON" | grep "browser_download_url" | grep -iE "$ext" | grep -iE "$ARCH_FILTER" | head -n1 | sed -E 's/.*"([^"]+)".*/\1/'
}

# 3. Detect distribution packaging method
INSTALLED=0

if command -v dnf >/dev/null 2>&1; then
  RPM_URL=$(get_asset_url "\.rpm$")
  if [ -n "$RPM_URL" ]; then
    echo "📥 Downloading Fedora/RPM package: $RPM_URL..."
    TMP_RPM="/tmp/kenote-latest.rpm"
    if command -v curl >/dev/null 2>&1; then
      curl -fSL "$RPM_URL" -o "$TMP_RPM"
    else
      wget -q "$RPM_URL" -O "$TMP_RPM"
    fi
    echo "⚙️ Installing RPM via dnf (may prompt for sudo password)..."
    sudo dnf install -y "$TMP_RPM"
    rm -f "$TMP_RPM"
    INSTALLED=1
  fi
elif command -v apt-get >/dev/null 2>&1; then
  DEB_URL=$(get_asset_url "\.deb$")
  if [ -n "$DEB_URL" ]; then
    echo "📥 Downloading Debian/Ubuntu package: $DEB_URL..."
    TMP_DEB="/tmp/kenote-latest.deb"
    if command -v curl >/dev/null 2>&1; then
      curl -fSL "$DEB_URL" -o "$TMP_DEB"
    else
      wget -q "$DEB_URL" -O "$TMP_DEB"
    fi
    echo "⚙️ Installing DEB via apt (may prompt for sudo password)..."
    sudo apt-get install -y "$TMP_DEB" || {
      sudo dpkg -i "$TMP_DEB"
      sudo apt-get install -f -y
    }
    rm -f "$TMP_DEB"
    INSTALLED=1
  fi
fi

# Fallback: Portable AppImage installation into ~/.local
if [ $INSTALLED -eq 0 ]; then
  APPIMAGE_URL=$(get_asset_url "\.appimage$")
  if [ -z "$APPIMAGE_URL" ]; then
    echo "❌ No suitable package or AppImage found for your system architecture ($ARCH)."
    exit 1
  fi

  echo "📥 Downloading portable AppImage: $APPIMAGE_URL..."
  INSTALL_DIR="$HOME/.local/bin"
  mkdir -p "$INSTALL_DIR"
  APPIMAGE_DEST="$INSTALL_DIR/kenote"

  if command -v curl >/dev/null 2>&1; then
    curl -fSL "$APPIMAGE_URL" -o "$APPIMAGE_DEST"
  else
    wget -q "$APPIMAGE_URL" -O "$APPIMAGE_DEST"
  fi

  chmod +x "$APPIMAGE_DEST"
  echo "✅ Saved executable to $APPIMAGE_DEST"

  # Setup AppImage icon & desktop entry
  ICON_DIR="$HOME/.local/share/icons/hicolor/512x512/apps"
  mkdir -p "$ICON_DIR"
  ICON_URL="https://raw.githubusercontent.com/$REPO/main/src-tauri/icons/icon.png"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$ICON_URL" -o "$ICON_DIR/kenote.png" 2>/dev/null || true
  else
    wget -q "$ICON_URL" -O "$ICON_DIR/kenote.png" 2>/dev/null || true
  fi
fi

# 4. Ensure desktop entry and MIME associations exist
DESKTOP_DIR="$HOME/.local/share/applications"
mkdir -p "$DESKTOP_DIR"

cat << 'EOF' > "$DESKTOP_DIR/Kenote.desktop"
[Desktop Entry]
Name=Kenote
Comment=Minimal Raycast-like Note Taking App
Exec=kenote %F
Icon=kenote
Terminal=false
Type=Application
StartupWMClass=kenote
Categories=Utility;TextEditor;Office;Productivity;
MimeType=text/plain;text/markdown;text/x-markdown;
Keywords=notes;markdown;editor;raycast;
EOF

# 5. Refresh system caches & register default handlers
echo "🔄 Updating desktop databases..."
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
fi

if command -v kbuildsycoca6 >/dev/null 2>&1; then
  kbuildsycoca6 >/dev/null 2>&1 || true
elif command -v kbuildsycoca5 >/dev/null 2>&1; then
  kbuildsycoca5 >/dev/null 2>&1 || true
fi

if command -v xdg-mime >/dev/null 2>&1; then
  xdg-mime default Kenote.desktop text/markdown text/x-markdown text/plain 2>/dev/null || true
fi

echo ""
echo "========================================="
echo "🎉 Kenote has been successfully installed!"
echo "========================================="
echo "• Search for 'Kenote' in your app launcher (Super or Alt+Space)."
echo "• Double-clicking .md or .txt files will now open in Kenote."
echo "• You can also run 'kenote' directly from your terminal."

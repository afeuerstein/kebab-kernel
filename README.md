# OnePlus 8T (kebab) Kernel for LineageOS 24

This repository contains the Linux kernel source for the OnePlus 8T (codename: kebab) built for LineageOS 24.

## About

- **Device:** OnePlus 8T (kebab)
- **Platform:** Qualcomm SM8250 (Kona)
- **Architecture:** arm64
- **Target:** LineageOS 24

## Building

### Prerequisites

You need the following packages installed:

```bash
sudo apt-get install -y build-essential bc bison flex libssl-dev libncurses-dev gcc-aarch64-linux-gnu binutils-aarch64-linux-gnu
```

### Manual Build

To build the kernel manually:

```bash
# Clone the repository
git clone https://github.com/afeuerstein/kebab-kernel.git
cd kebab-kernel

# Checkout the correct branch
git checkout lineage-24.0

# Build using the build script
chmod +x build-kernel.sh
./build-kernel.sh
```

This will:
1. Use the `vendor/kona_defconfig` as the base configuration
2. Apply OnePlus-specific configurations from `oplus.config`
3. Build the kernel Image
4. Build DTB/DTBO images
5. Create a flashable boot.img

### Build Options

```bash
# Build with verbose output
./build-kernel.sh --verbose

# Build with specific number of jobs
./build-kernel.sh --jobs 8

# Clean build
./build-kernel.sh --clean

# Skip DTB building
./build-kernel.sh --no-dtb

# Skip boot.img packaging
./build-kernel.sh --no-package

# Custom output directory
./build-kernel.sh --output my-build

# Get help
./build-kernel.sh --help
```

### GitHub Actions Build

The repository includes GitHub Actions workflows for automated builds:

- **`.github/workflows/build-kernel-optimized.yml`** - Optimized build workflow
  - Runs on manual trigger or monthly schedule (1st of each month at 00:00 UTC)
  - Creates a GitHub release with the built kernel
  - Uploads artifacts for 7 days

To trigger a manual build:
1. Go to the Actions tab in GitHub
2. Select the "Build Kernel (Optimized)" workflow
3. Click "Run workflow"
4. Choose "manual" or "monthly" as the release type

## Output Files

After a successful build, the following files will be available:

- `out/arch/arm64/boot/Image` - Uncompressed kernel image
- `out/boot.img` - Flashable boot image (if mkbootimg is available)
- `out/Image-dtb` - Kernel with appended DTB (fallback if mkbootimg not available)
- `out/dtb.img` - Device tree blob image
- `out/dtbo.img` - Device tree blob overlay image
- `out/*.sha256` - SHA256 checksums for verification
- `kernel-build-*.zip` - Complete build archive

## Flashing

### Using fastboot

```bash
# Flash the boot image
fastboot flash boot boot.img

# Reboot
fastboot reboot
```

### Using custom recovery

1. Copy `boot.img` to your device
2. Flash it using your recovery's flash tool

## Configuration

The kernel uses the following configuration:

- **Base defconfig:** `vendor/kona_defconfig`
- **OnePlus overrides:** `arch/arm64/configs/vendor/oplus.config`

The `kona_defconfig` is specifically configured for Qualcomm SM8250 platforms, which includes the OnePlus 8T.

## Device Tree

The device tree files for kebab are located in:
- `arch/arm64/boot/dts/vendor/oplus/kebab/` - Device-specific overlays
- `arch/arm64/boot/dts/vendor/oplus/kona-kebab-overlay.dts` - Main overlay

## Automated Builds

### Monthly Builds

The workflow is configured to automatically build the kernel on the 1st of every month at 00:00 UTC. This ensures regular updates with the latest security patches and improvements.

### Manual Builds

You can trigger a manual build at any time through the GitHub Actions interface. This is useful for:
- Testing changes before merging
- Creating custom builds with specific configurations
- Building after important upstream updates

## Credits

- LineageOS team for the base kernel and configurations
- OnePlus for the original device-specific configurations
- Qualcomm for the SM8250 platform support

## License

This kernel is licensed under the GPLv2, as is standard for the Linux kernel.

---

**Note:** This is a custom kernel build. Flash at your own risk. Make sure to backup your data before flashing.

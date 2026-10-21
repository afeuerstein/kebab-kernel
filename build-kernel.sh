#!/bin/bash
# Build script for OnePlus 8T (kebab) kernel
# Usage: ./build-kernel.sh [options]
#
# Options:
#   -j, --jobs N       Number of parallel jobs (default: auto)
#   -o, --output DIR   Output directory (default: out)
#   -d, --defconfig F  Defconfig file (default: vendor/kona_defconfig)
#   -c, --clean        Clean build directory before building
#   -v, --verbose      Verbose output
#   --no-dtb          Skip DTB/DTBO building
#   --no-package      Skip packaging into boot.img
#   --help            Show this help

set -euo pipefail

# Default values
ARCH=arm64
DEFCONFIG="vendor/kona_defconfig"
OUTPUT_DIR="out"
JOBS=""
CLEAN=false
VERBOSE=false
BUILD_DTB=true
PACKAGE_BOOT=true

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -j|--jobs)
            JOBS="-j$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -d|--defconfig)
            DEFCONFIG="$2"
            shift 2
            ;;
        -c|--clean)
            CLEAN=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        --no-dtb)
            BUILD_DTB=false
            shift
            ;;
        --no-package)
            PACKAGE_BOOT=false
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  -j, --jobs N       Number of parallel jobs (default: auto)"
            echo "  -o, --output DIR   Output directory (default: out)"
            echo "  -d, --defconfig F  Defconfig file (default: vendor/kona_defconfig)"
            echo "  -c, --clean        Clean build directory before building"
            echo "  -v, --verbose      Verbose output"
            echo "  --no-dtb          Skip DTB/DTBO building"
            echo "  --no-package      Skip packaging into boot.img"
            echo "  --help            Show this help"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Set up toolchain
if ! command -v aarch64-linux-gnu-gcc &> /dev/null; then
    echo "Error: aarch64 toolchain not found"
    echo "Install with: sudo apt-get install gcc-aarch64-linux-gnu binutils-aarch64-linux-gnu"
    exit 1
fi

CROSS_COMPILE=aarch64-linux-gnu-

echo "Using CROSS_COMPILE: ${CROSS_COMPILE}"

# Create output directory
mkdir -p "${OUTPUT_DIR}"

# Clean if requested
if [ "${CLEAN}" = true ]; then
    echo "Cleaning output directory..."
    rm -rf "${OUTPUT_DIR}"
    mkdir -p "${OUTPUT_DIR}"
fi

# Set jobs
if [ -z "${JOBS}" ]; then
    JOBS="-j$(nproc)"
fi

echo "Building with ${JOBS}"
echo "Output directory: ${OUTPUT_DIR}"
echo "Defconfig: ${DEFCONFIG}"

# Build kernel
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

echo "=== Building kernel ==="
if [ "${VERBOSE}" = true ]; then
    make ARCH=${ARCH} CROSS_COMPILE=${CROSS_COMPILE} ${DEFCONFIG} O=${OUTPUT_DIR}
    
    # Apply oplus.config
    if [ -f arch/arm64/configs/vendor/oplus.config ]; then
        echo "Applying oplus.config overrides..."
        cat arch/arm64/configs/vendor/oplus.config >> ${OUTPUT_DIR}/.config
        make ARCH=${ARCH} CROSS_COMPILE=${CROSS_COMPILE} olddefconfig O=${OUTPUT_DIR}
    fi
    
    make ${JOBS} ARCH=${ARCH} CROSS_COMPILE=${CROSS_COMPILE} O=${OUTPUT_DIR} 2>&1 | tee build.log
else
    make ARCH=${ARCH} CROSS_COMPILE=${CROSS_COMPILE} ${DEFCONFIG} O=${OUTPUT_DIR} > /dev/null
    
    if [ -f arch/arm64/configs/vendor/oplus.config ]; then
        cat arch/arm64/configs/vendor/oplus.config >> ${OUTPUT_DIR}/.config
        make ARCH=${ARCH} CROSS_COMPILE=${CROSS_COMPILE} olddefconfig O=${OUTPUT_DIR} > /dev/null
    fi
    
    make ${JOBS} ARCH=${ARCH} CROSS_COMPILE=${CROSS_COMPILE} O=${OUTPUT_DIR} 2>&1 | tail -20
fi

# Check if build succeeded
if [ ! -f ${OUTPUT_DIR}/arch/arm64/boot/Image ]; then
    echo "Error: Build failed - kernel image not found"
    exit 1
fi

echo "Kernel built successfully!"

# Build DTB/DTBO
if [ "${BUILD_DTB}" = true ]; then
    echo ""
    echo "=== Building DTB/DTBO ==="
    
    # Build DTBO
    if [ "${VERBOSE}" = true ]; then
        make ${JOBS} ARCH=${ARCH} CROSS_COMPILE=${CROSS_COMPILE} dtbo.img O=${OUTPUT_DIR} 2>&1 | tee dtbo_build.log
    else
        make ${JOBS} ARCH=${ARCH} CROSS_COMPILE=${CROSS_COMPILE} dtbo.img O=${OUTPUT_DIR} > /dev/null 2>&1 || true
    fi
    
    # Collect all dtb files
    mkdir -p ${OUTPUT_DIR}/dtb
    find ${OUTPUT_DIR}/arch/arm64/boot/dts -name "*.dtb" -exec cp {} ${OUTPUT_DIR}/dtb/ \;
    
    # Create dtb.img
    if [ -f ${OUTPUT_DIR}/dtbo.img ]; then
        echo "dtbo.img already built"
    else
        # Try to create from individual dtb files
        if ls ${OUTPUT_DIR}/dtb/*.dtb 1> /dev/null 2>&1; then
            cat ${OUTPUT_DIR}/dtb/*.dtb > ${OUTPUT_DIR}/dtb.img
            echo "Created dtb.img from individual dtb files"
        fi
    fi
    
    # Also copy dtbo.img if it exists
    if [ -f ${OUTPUT_DIR}/arch/arm64/boot/dtbo.img ]; then
        cp ${OUTPUT_DIR}/arch/arm64/boot/dtbo.img ${OUTPUT_DIR}/dtbo.img
    fi
    
    echo "DTB/DTBO built successfully!"
fi

# Package boot.img
if [ "${PACKAGE_BOOT}" = true ]; then
    echo ""
    echo "=== Packaging boot.img ==="
    
    # Create a minimal ramdisk
    mkdir -p ${OUTPUT_DIR}/ramdisk
    (cd ${OUTPUT_DIR}/ramdisk && find . | cpio -H newc -o | gzip > ../ramdisk.cpio.gz)
    
    # Get kernel command line from defconfig
    CMDLINE=$(grep "CONFIG_CMDLINE=" ${OUTPUT_DIR}/.config | sed 's/CONFIG_CMDLINE="//;s/"$//' | sed 's/" //g')
    echo "Kernel command line: ${CMDLINE}"
    
    # Get base address from defconfig
    BASE=$(grep "CONFIG_ARM64_TEXT_OFFSET=" ${OUTPUT_DIR}/.config | sed 's/CONFIG_ARM64_TEXT_OFFSET=0x//;s/0x//' | sed 's/.*=//')
    if [ -z "$BASE" ]; then
        BASE=0x80000
    fi
    
    echo "Base address: ${BASE}"
    
    # Try to use mkbootimg if available
    if command -v mkbootimg &> /dev/null; then
        echo "Using mkbootimg..."
        mkbootimg --kernel ${OUTPUT_DIR}/arch/arm64/boot/Image \
                  --ramdisk ${OUTPUT_DIR}/ramdisk.cpio.gz \
                  --cmdline "${CMDLINE}" \
                  --base ${BASE} \
                  --pagesize 2048 \
                  --kernel_offset 0x00008000 \
                  --ramdisk_offset 0x02000000 \
                  --second_offset 0x00f00000 \
                  --tags_offset 0x01e00000 \
                  --os_version 13.0 \
                  --os_patch_level 2024-01-01 \
                  --output ${OUTPUT_DIR}/boot.img
        echo "boot.img created using mkbootimg"
    else
        echo "mkbootimg not available, creating Image-dtb..."
        # Fallback: just package kernel and dtb
        cat ${OUTPUT_DIR}/arch/arm64/boot/Image ${OUTPUT_DIR}/dtb.img > ${OUTPUT_DIR}/Image-dtb
        cp ${OUTPUT_DIR}/arch/arm64/boot/Image ${OUTPUT_DIR}/boot.img
        echo "Created Image-dtb and copied Image as boot.img"
    fi
fi

# Create checksums
echo ""
echo "=== Creating checksums ==="
cd ${OUTPUT_DIR}
sha256sum boot.img > boot.img.sha256 2>/dev/null || true
sha256sum Image-dtb > Image-dtb.sha256 2>/dev/null || true
sha256sum dtb.img > dtb.img.sha256 2>/dev/null || true
sha256sum dtbo.img > dtbo.img.sha256 2>/dev/null || true
cd ..

echo ""
echo "=== Build Summary ==="
echo "Output directory: ${OUTPUT_DIR}"
ls -lh ${OUTPUT_DIR}/arch/arm64/boot/Image 2>/dev/null || true
ls -lh ${OUTPUT_DIR}/boot.img 2>/dev/null || true
ls -lh ${OUTPUT_DIR}/Image-dtb 2>/dev/null || true
ls -lh ${OUTPUT_DIR}/dtb.img 2>/dev/null || true
ls -lh ${OUTPUT_DIR}/dtbo.img 2>/dev/null || true

echo ""
echo "Build completed successfully!"

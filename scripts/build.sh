#!/bin/bash

# Ensure we are in the project root
cd "$(dirname "$0")/.."

# Create the releases directory if it doesn't exist
mkdir -p releases

echo "Building extension with web-ext..."

# Use npx to run web-ext without requiring a global install
# --overwrite-dest: Overwrites the destination if it already exists
# --artifacts-dir: Specifies where to save the build artifact
npx web-ext build --overwrite-dest --artifacts-dir releases/

# Find the newly created .zip file and rename it to .xpi
# web-ext build names the file based on the manifest name and version
# We only process .zip files to avoid double-renaming if .xpi already exist
for f in releases/*.zip; do
    if [ -f "$f" ]; then
        new_name="${f%.zip}.xpi"
        # If the .xpi version already exists, remove it first to allow rename
        if [ -f "$new_name" ]; then
            rm "$new_name"
        fi
        mv "$f" "$new_name"
        echo "Successfully created: $new_name"
    fi
done

echo "Build process finished. Files are in the 'releases/' directory."

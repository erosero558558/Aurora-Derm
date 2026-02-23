<?php

$directories = ['images', 'content'];

echo "Starting image optimization...\n";

foreach ($directories as $dir) {
    if (!is_dir($dir)) {
        echo "Directory not found: $dir\n";
        continue;
    }

    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir));

    foreach ($iterator as $file) {
        if ($file->isDir()) {
            continue;
        }

        $path = $file->getPathname();
        $ext = strtolower($file->getExtension());

        if (in_array($ext, ['jpg', 'jpeg', 'png'])) {
            $webpPath = preg_replace('/\.' . $ext . '$/i', '.webp', $path);

            // Skip if webp exists and is newer
            if (file_exists($webpPath) && filemtime($webpPath) >= filemtime($path)) {
                continue;
            }

            echo "Converting $path to WebP...\n";

            $image = null;
            try {
                if ($ext === 'png') {
                    $image = @imagecreatefrompng($path);
                    if ($image) {
                        imagepalettetotruecolor($image);
                        imagealphablending($image, true);
                        imagesavealpha($image, true);
                    }
                } else {
                    $image = @imagecreatefromjpeg($path);
                }

                if ($image) {
                    imagewebp($image, $webpPath, 85); // Quality 85
                    imagedestroy($image);
                } else {
                    echo "Failed to load image: $path\n";
                }
            } catch (Exception $e) {
                echo "Error processing $path: " . $e->getMessage() . "\n";
            }
        }
    }
}

echo "Image optimization complete.\n";

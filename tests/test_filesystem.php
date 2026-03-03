<?php

declare(strict_types=1);

function delete_path_recursive(string $path): void
{
    if ($path === '' || !file_exists($path)) {
        return;
    }

    if (is_file($path) || is_link($path)) {
        @unlink($path);
        return;
    }

    if (function_exists('close_db_connection')) {
        close_db_connection();
    }

    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );

    foreach ($iterator as $entry) {
        $entryPath = $entry->getPathname();
        if ($entry->isDir() && !$entry->isLink()) {
            @rmdir($entryPath);
            continue;
        }

        @unlink($entryPath);
    }

    @rmdir($path);
}

function ensure_clean_directory(string $path, int $mode = 0777): void
{
    delete_path_recursive($path);

    if (!is_dir($path) && !mkdir($path, $mode, true) && !is_dir($path)) {
        throw new RuntimeException("Failed to create directory: {$path}");
    }
}

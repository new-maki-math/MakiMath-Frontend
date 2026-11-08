export function formatFileSize(size) {
  if (!Number.isSafeInteger(size) || size < 0) {
    return '—';
  }
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KiB`;
  }
  return `${(size / 1024 / 1024).toFixed(1)} MiB`;
}

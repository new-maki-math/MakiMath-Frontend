export function withStorageWrite(task) {
  if (!navigator.locks) {
    return task();
  }
  return navigator.locks.request('maki-user-data', {
 mode: 'shared' 
}, task);
}

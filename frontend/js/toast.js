// toast.js —— 轻量错误提示
let container;

function getContainer() {
  if (!container) container = document.getElementById('toast-container');
  return container;
}

export function toast(message, type = 'error', ttl = 4200) {
  const box = document.createElement('div');
  box.className = `toast toast-${type}`;
  box.textContent = message;
  getContainer().appendChild(box);
  setTimeout(() => {
    box.style.transition = 'opacity .3s';
    box.style.opacity = '0';
    setTimeout(() => box.remove(), 320);
  }, ttl);
}

// dom.js —— 极简 DOM 辅助
export function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'html') el.innerHTML = value;
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, value);
  }
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child == null || child === false) continue;
    el.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function debounce(fn, wait) {
  let timer = null;
  let lastArgs = null;
  const wrapped = (...args) => {
    lastArgs = args;
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...lastArgs);
    }, wait);
  };
  wrapped.flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
      fn(...lastArgs);
    }
  };
  return wrapped;
}

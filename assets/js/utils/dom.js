// Helper DOM kecil untuk membuat node aman tanpa string HTML mentah.
const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set([
  'svg',
  'path',
  'circle',
  'rect',
  'line',
  'polyline',
  'polygon',
  'g',
]);

export const el = (tag, props = {}, ...children) => {
  const node = SVG_TAGS.has(tag)
    ? document.createElementNS(SVG_NS, tag)
    : document.createElement(tag);
  Object.entries(props).forEach(([key, value]) => {
    if (key === 'class') {
      if (SVG_TAGS.has(tag)) {
        node.setAttribute('class', value);
      } else {
        node.className = value;
      }
    } else if (key === 'dataset') {
      Object.assign(node.dataset, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2), value);
    } else if (key === 'html') {
      node.textContent = value;
    } else if (value !== false && value != null) {
      node.setAttribute(key, value === true ? '' : value);
    }
  });
  children.flat(Infinity).forEach((child) => {
    if (child == null || child === false) return;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  });
  return node;
};

export const h = el;

export const escapeHtml = (value = '') => String(value).replace(
  /[&<>"']/g,
  (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]),
);

export const clear = (node) => {
  while (node.firstChild) node.removeChild(node.firstChild);
};

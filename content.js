// content.js —— PICKCAT 自动加后缀

(function () {
  'use strict';

  const DEFAULT_SUFFIXES = ['喵'];
  const STORAGE_KEY = 'pickcat_suffixes';
  const DEBUG = true;
  const log = (...a) => DEBUG && console.log('[加后缀]', ...a);

  // ========== 配置缓存（同步访问） ==========
  let cachedSuffixes = DEFAULT_SUFFIXES.slice();

  // 首次异步加载
  chrome.storage.local.get(STORAGE_KEY, (result) => {
    const v = result[STORAGE_KEY];
    if (Array.isArray(v) && v.length > 0) cachedSuffixes = v;
    log('配置已加载：', cachedSuffixes);
  });

  // 监听 popup 修改配置，实时同步
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[STORAGE_KEY]) {
      const v = changes[STORAGE_KEY].newValue;
      if (Array.isArray(v) && v.length > 0) {
        cachedSuffixes = v;
        log('配置已更新：', cachedSuffixes);
      }
    }
  });

  const primarySuffix = () => cachedSuffixes[0] || '喵';
  const endsWithAnySuffix = (text) =>
    cachedSuffixes.some(s => s && text.endsWith(s));

  // ========== 工具 ==========
  function setNativeValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  }

  function findEditable(node) {
    let n = node;
    while (n && n !== document.body) {
      if (n.nodeType === 1) {
        if (n.isContentEditable) return n;
        if (n.tagName === 'TEXTAREA') return n;
        if (n.tagName === 'INPUT' && /^(text|search|url|email)$/i.test(n.type)) return n;
      }
      n = n.parentNode;
    }
    return null;
  }

  // ========== 补后缀 ==========
  function handleFormField(el) {
    const suffix = primarySuffix();
    const pos = el.selectionStart ?? el.value.length;
    const before = el.value.slice(0, pos);
    const lines = before.split('\n');
    const currentLine = lines[lines.length - 1] || '';
    const trimmed = currentLine.replace(/[\s\r]+$/, '');
    if (!trimmed || endsWithAnySuffix(trimmed)) return false;

    setNativeValue(el, before + suffix + el.value.slice(pos));
    el.selectionStart = el.selectionEnd = pos + suffix.length;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  function handleContentEditable(el) {
    const suffix = primarySuffix();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return false;
    const range = sel.getRangeAt(0);
    const container = range.startContainer;

    const before = container.nodeType === 3
      ? container.textContent.slice(0, range.startOffset)
      : '';
    const trimmed = before.replace(/[\s\r]+$/, '');
    if (!trimmed || endsWithAnySuffix(trimmed)) return false;

    const node = document.createTextNode(suffix);
    try { range.insertNode(node); } catch (e) { log('插入失败', e); return false; }
    range.setStartAfter(node);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    el.dispatchEvent(new InputEvent('input', {
      bubbles: true, inputType: 'insertText', data: suffix,
    }));
    return true;
  }

  // ========== 事件 ==========
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    const el = findEditable(e.target);
    if (!el) return;

    let ok = false;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') ok = handleFormField(el);
    else if (el.isContentEditable) ok = handleContentEditable(el);
    if (ok) log('Enter 前补后缀');
  }, true);

  document.addEventListener('blur', (e) => {
    const el = e.target;
    if (!el || !el.matches) return;
    const suffix = primarySuffix();

    if (el.tagName === 'INPUT' && /^(text|search|url|email)$/i.test(el.type)) {
      const trimmed = (el.value || '').replace(/[\s\r]+$/, '');
      if (!trimmed || trimmed.includes('\n') || endsWithAnySuffix(trimmed)) return;
      setNativeValue(el, trimmed + suffix);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      log('INPUT 失焦补后缀');
      return;
    }

    if (el.tagName === 'TEXTAREA') {
      const v = el.value || '';
      if (!v) return;
      const lines = v.split('\n');
      const last = lines[lines.length - 1].replace(/[\s\r]+$/, '');
      if (!last || endsWithAnySuffix(last)) return;
      lines[lines.length - 1] = last + suffix;
      setNativeValue(el, lines.join('\n'));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      log('TEXTAREA 失焦补后缀');
    }
  }, true);

  log('content.js 已加载，当前后缀：', cachedSuffixes);
})();
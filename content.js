// content.js

(function () {
  'use strict';

  const ENABLED_KEY = 'pickcat_enabled';
  const SUFFIXES_KEY = 'pickcat_suffixes_v2';
  const RANDOM_KEY = 'pickcat_random';

  let isEnabled = true;
  let isRandom = false;
  let suffixesList = [{ text: '喵', enabled: true }];

  // ================= 配置加载与更新 =================
  function loadConfig(callback) {
    chrome.storage.local.get([ENABLED_KEY, SUFFIXES_KEY, RANDOM_KEY], (result) => {
      isEnabled = result[ENABLED_KEY] !== false;
      isRandom = result[RANDOM_KEY] === true;
      
      let v = result[SUFFIXES_KEY];
      if (!v || !Array.isArray(v)) {
        const old = result['pickcat_suffixes'];
        if (Array.isArray(old)) {
  		v = old.map((t, index) => ({ text: t, enabled: index === 0 }));
	} else {
          v = [{ text: '喵', enabled: true }];
        }
      }
      suffixesList = v;
      if (callback) callback();
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') loadConfig();
  });

  // ================= 获取当前可用后缀 =================
  function getActiveSuffixes() {
    return suffixesList.filter(s => s.enabled).map(s => s.text);
  }

  function getOneSuffix() {
    const active = getActiveSuffixes();
    if (active.length === 0) return '';
    if (isRandom) return active[Math.floor(Math.random() * active.length)];
    return active[0];
  }

  function endsWithAnySuffix(text) {
    const active = getActiveSuffixes();
    return active.some(s => text.endsWith(s));
  }

  // ================= 工具 =================
  function setNativeValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  }

  // ===== 新增：判断是不是搜索页面 =====
  function isSearchPage() {
    return location.pathname.startsWith('/search');
  }

  // ===== 增强：判断是不是搜索框 =====
  function isSearchInput(el) {
    if (el.tagName !== 'INPUT') return false;
    if (el.type === 'search') return true;
    
    const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
    const name = (el.getAttribute('name') || '').toLowerCase();
    const idClass = (el.id + ' ' + el.className).toLowerCase();
    
    if (placeholder.includes('搜索') || placeholder.includes('search')) return true;
    if (name.includes('search') || name.includes('keyword') || name === 'q') return true;
    if (idClass.includes('search')) return true;

    // 顺藤摸瓜：检查它的父级元素有没有 search 相关的类名
    let parent = el.parentElement;
    for (let i = 0; i < 3 && parent; i++) {
      const pClass = (parent.id + ' ' + parent.className).toLowerCase();
      if (pClass.includes('search')) return true;
      parent = parent.parentElement;
    }
    return false;
  }

  function findEditable(node) {
    let n = node;
    while (n && n !== document.body) {
      if (n.nodeType === 1) {
        if (n.isContentEditable) return n;
        if (n.tagName === 'TEXTAREA') return n;
        if (n.tagName === 'INPUT' && /^(text|url|email)$/i.test(n.type)) {
          if (isSearchInput(n)) return null;
          return n;
        }
      }
      n = n.parentNode;
    }
    return null;
  }

  // ================= 核心补后缀逻辑 =================

  function insertAtCursor(el) {
    const suffix = getOneSuffix();
    if (!suffix) return;

    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      const pos = el.selectionStart ?? el.value.length;
      const before = el.value.slice(0, pos);
      const currentLine = before.split('\n').pop() || '';
      const trimmed = currentLine.replace(/[\s\r]+$/, '');
      if (!trimmed || endsWithAnySuffix(trimmed)) return;

      setNativeValue(el, before + suffix + el.value.slice(pos));
      el.selectionStart = el.selectionEnd = pos + suffix.length;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (el.isContentEditable) {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      const container = range.startContainer;
      
      const before = container.nodeType === 3 ? container.textContent.slice(0, range.startOffset) : '';
      const trimmed = before.replace(/[\s\r]+$/, '');
      if (!trimmed || endsWithAnySuffix(trimmed)) return;

      const node = document.createTextNode(suffix);
      try { range.insertNode(node); } catch (e) { return; }
      range.setStartAfter(node);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: suffix }));
    }
  }

  function ensureAllText(el) {
    if (!el) return;
    
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      const lines = el.value.split('\n');
      let changed = false;
      const newLines = lines.map(line => {
        const trimmed = line.replace(/[\s\r]+$/, '');
        if (!trimmed || endsWithAnySuffix(trimmed)) return line;
        changed = true;
        return trimmed + getOneSuffix();
      });
      if (changed) {
        setNativeValue(el, newLines.join('\n'));
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } else if (el.isContentEditable) {
      const text = el.innerText;
      const lines = text.split('\n');
      let changed = false;
      const newLines = lines.map(line => {
        const trimmed = line.replace(/[\s\r]+$/, '');
        if (!trimmed || endsWithAnySuffix(trimmed)) return line;
        changed = true;
        return trimmed + getOneSuffix();
      });
      if (changed) {
        el.innerText = newLines.join('\n');
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '' }));
      }
    }
  }

  // ================= 事件监听 =================

  // 1. Enter 键
  document.addEventListener('keydown', (e) => {
    if (!isEnabled || e.key !== 'Enter' || e.shiftKey) return;
    
    // 如果是搜索页面，直接不管
    if (isSearchPage()) return; 

    const el = findEditable(e.target);
    if (el) insertAtCursor(el);
  }, true);

  // 2. 失焦
  document.addEventListener('blur', (e) => {
    if (!isEnabled) return;
    if (isSearchPage()) return;

    const el = findEditable(e.target);
    if (el) ensureAllText(el);
  }, true);

  // 3. 发布/回复按钮点击拦截
  document.addEventListener('click', (e) => {
    if (!isEnabled) return;
    if (isSearchPage()) return;

    const btn = e.target.closest('button, [role="button"], .btn, svg');
    const btnText = (btn?.textContent || '').trim();
    
    const isPublish = btnText.includes('发布') || btnText.includes('回复') || btnText.includes('发送');
    const isIconSend = btn?.tagName === 'svg' || btn?.querySelector('svg') || btn?.className?.includes('icon');

    if (isPublish || isIconSend) {
      document.querySelectorAll('textarea, [contenteditable="true"]').forEach(el => {
        if (el.offsetHeight > 0 && el.offsetWidth > 0) ensureAllText(el);
      });

      // 只有在发帖页面（/forum/editor）才去扫描单行标题，且必须过搜索框验证
      if (location.pathname.startsWith('/forum/editor')) {
        document.querySelectorAll('input[type="text"]').forEach(el => {
          if (isSearchInput(el)) return; 
          if (el.offsetHeight > 0 && el.offsetWidth > 0) ensureAllText(el);
        });
      }
    }
  }, true);

  loadConfig(() => {
    console.log('[加后缀] content.js v6.3 已加载');
  });

})();
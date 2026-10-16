const DEFAULT_SUFFIXES = ['喵'];
const STORAGE_KEY = 'pickcat_suffixes';
const input = document.getElementById('suffixInput');

// 加载当前配置
chrome.storage.local.get(STORAGE_KEY, (result) => {
  const v = result[STORAGE_KEY];
  if (Array.isArray(v) && v.length > 0) {
    input.value = v.join(',');
  } else {
    input.value = DEFAULT_SUFFIXES.join(',');
  }
});

// 保存
document.getElementById('saveBtn').addEventListener('click', () => {
  const arr = input.value.split(',').map(s => s.trim()).filter(Boolean);
  if (arr.length === 0) {
    alert('至少要填一个后缀');
    return;
  }
  chrome.storage.local.set({ [STORAGE_KEY]: arr }, () => {
    alert('已保存：' + arr.join(' / '));
  });
});

// 恢复默认
document.getElementById('resetBtn').addEventListener('click', () => {
  chrome.storage.local.set({ [STORAGE_KEY]: DEFAULT_SUFFIXES }, () => {
    input.value = DEFAULT_SUFFIXES.join(',');
    alert('已恢复默认：喵');
  });
});
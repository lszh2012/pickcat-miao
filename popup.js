const ENABLED_KEY = 'pickcat_enabled';
const SUFFIXES_KEY = 'pickcat_suffixes_v2';
const RANDOM_KEY = 'pickcat_random';

const enableToggle = document.getElementById('enableToggle');
const randomToggle = document.getElementById('randomToggle');
const configArea = document.getElementById('configArea');
const suffixListEl = document.getElementById('suffixList');
const newSuffixInput = document.getElementById('newSuffix');

let suffixes = [];

// 渲染列表
function renderList() {
  suffixListEl.innerHTML = '';
  suffixes.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'suffix-item';
    
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = item.enabled;
    
    // 勾选时的智能判断
    cb.addEventListener('change', (e) => {
      const isRandom = randomToggle.checked;
      const isChecked = e.target.checked;

      if (isChecked) {
        // 非随机模式下，只能单选
        if (!isRandom) {
          suffixes.forEach((s, i) => {
            if (i !== index) s.enabled = false;
          });
        }
      } else {
        // 防止一个都没选
        const hasOtherChecked = suffixes.some((s, i) => i !== index && s.enabled);
        if (!hasOtherChecked) {
          e.target.checked = true;
          return alert('请至少保留一个后缀，否则不会生效');
        }
      }
      
      suffixes[index].enabled = isChecked;
      saveSuffixes();
      renderList();
    });
    
    const span = document.createElement('span');
    span.textContent = item.text;
    
    label.appendChild(cb);
    label.appendChild(span);
    
    const delBtn = document.createElement('button');
    delBtn.className = 'del-btn';
    delBtn.textContent = '×';
    
    // 删除时的兜底
    delBtn.onclick = () => {
      const wasEnabled = suffixes[index].enabled;
      suffixes.splice(index, 1);
      
      if (wasEnabled && suffixes.length > 0) {
        if (!suffixes.some(s => s.enabled)) {
          suffixes[0].enabled = true;
        }
      }
      
      saveSuffixes();
      renderList();
    };
    
    div.appendChild(label);
    div.appendChild(delBtn);
    suffixListEl.appendChild(div);
  });
}

// 保存到 storage
function saveSuffixes() {
  chrome.storage.local.set({ [SUFFIXES_KEY]: suffixes });
}

// ================= 初始化 =================
chrome.storage.local.get([ENABLED_KEY, SUFFIXES_KEY, RANDOM_KEY], (result) => {
  // 1. 总开关
  const isEnabled = result[ENABLED_KEY] !== false;
  enableToggle.checked = isEnabled;
  configArea.style.opacity = isEnabled ? '1' : '0.4';
  configArea.style.pointerEvents = isEnabled ? 'auto' : 'none';

  // 2. 随机开关
  randomToggle.checked = result[RANDOM_KEY] === true;

  // 3. 后缀列表与数据迁移
  let v = result[SUFFIXES_KEY];
  let needSave = false;

  if (!v || !Array.isArray(v)) {
    const old = result['pickcat_suffixes'];
    if (Array.isArray(old)) {
      // 迁移：只启用第一个
      v = old.map((t, index) => ({ text: t, enabled: index === 0 }));
    } else {
      v = [{ text: '喵', enabled: true }];
    }
    needSave = true;
  }
  
  suffixes = v;
  
  // 兜底：如果异常导致一个都没勾选，强行勾选第一个
  if (suffixes.length > 0 && !suffixes.some(s => s.enabled)) {
    suffixes[0].enabled = true;
    needSave = true;
  }
  
  if (needSave) {
    saveSuffixes();
  }
  
  renderList();
});

// ================= 事件监听 =================

// 监听总开关
enableToggle.addEventListener('change', (e) => {
  const val = e.target.checked;
  chrome.storage.local.set({ [ENABLED_KEY]: val });
  configArea.style.opacity = val ? '1' : '0.4';
  configArea.style.pointerEvents = val ? 'auto' : 'none';
});

// 监听随机开关
randomToggle.addEventListener('change', (e) => {
  const isRandom = e.target.checked;
  chrome.storage.local.set({ [RANDOM_KEY]: isRandom });
  
  if (!isRandom) {
    let foundFirst = false;
    let changed = false;
    suffixes.forEach(s => {
      if (s.enabled) {
        if (!foundFirst) foundFirst = true;
        else {
          s.enabled = false;
          changed = true;
        }
      }
    });
    if (changed) {
      saveSuffixes();
      renderList();
    }
  }
});

// 添加新后缀
document.getElementById('addBtn').addEventListener('click', () => {
  const text = newSuffixInput.value.trim();
  if (!text) return;
  if (suffixes.some(s => s.text === text)) return alert('已存在该后缀');
  
  const isRandom = randomToggle.checked;
  
  if (!isRandom) {
    suffixes.forEach(s => s.enabled = false);
  }
  
  suffixes.push({ text, enabled: true });
  newSuffixInput.value = '';
  saveSuffixes();
  renderList();
});

newSuffixInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') document.getElementById('addBtn').click();
});
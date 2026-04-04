/**
 * Utility Functions
 * 多言語化、トースト通知、ファイルダウンロードなどの共通ツール
 */

// 多言語化 (i18n) 初期化
export function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(elem => {
    const msgKey = elem.getAttribute('data-i18n');
    const translated = chrome.i18n.getMessage(msgKey);
    if (translated) {
      if (elem.tagName === 'INPUT' && elem.hasAttribute('placeholder')) {
        elem.placeholder = translated;
      } else {
        elem.textContent = translated;
      }
    }
  });

  document.querySelectorAll('[data-i18n-title]').forEach(elem => {
    const msgKey = elem.getAttribute('data-i18n-title');
    const translated = chrome.i18n.getMessage(msgKey);
    if (translated) {
      elem.title = translated;
    }
  });
}

// トースト通知を表示
export function showToast(message, duration = 2000) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

// ファイルダウンロード
export function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// 日付フォーマット
export function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const locale = chrome.i18n.getUILanguage() || 'ja-JP';
  return d.toLocaleDateString(locale, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

// HTMLエスケープ (XSS対策)
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
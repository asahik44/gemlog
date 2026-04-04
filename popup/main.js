/**
 * Main Controller
 * 全モジュールを統合し、イベントリスナーの登録と初期化を行う司令塔
 */

import { applyTranslations, showToast, downloadFile, formatDate, escapeHtml } from './utils.js';
import { summarizeCurrentChat, copySummary } from './api-manager.js';
import { switchTab, updateStorageUsage, toggleApiFields, openChatDetail, renderManagedList } from './ui-manager.js';

let currentChatId = null;

// UIマネージャーからcurrentChatIdを更新してもらうためのコールバック関数
const setCurrentChatId = (id) => { currentChatId = id; };

// ========== チャット一覧の描画と出力（エクスポート）機能 ==========
async function renderChatList() {
  const index = await GemLogStorage.getChatIndex();
  const container = document.getElementById('chatList');
  const chats = Object.values(index).sort((a, b) => new Date(b.updated || b.created) - new Date(a.updated || a.created));

  if (chats.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">💬</div>
        <p>${chrome.i18n.getMessage("noChatsMessage")}</p>
        <p style="font-size:11px;margin-top:4px;">${chrome.i18n.getMessage("noChatsSubMessage")}</p>
      </div>`;
    return;
  }

  container.innerHTML = chats.map(chat => `
    <div class="chat-item" data-chatid="${chat.id}">
      <div class="chat-info">
        <div class="chat-title">${escapeHtml(chat.title || chrome.i18n.getMessage("untitledChat"))}</div>
        <div class="chat-meta">${chat.messageCount || 0} ${chrome.i18n.getMessage("itemCount")} · ${formatDate(chat.updated || chat.created)}</div>
      </div>
      <div class="chat-actions">
        <button class="btn sm copy-md-btn" data-chatid="${chat.id}" title="MD">📋 MD</button>
        <button class="btn sm copy-json-btn" data-chatid="${chat.id}" title="JSON">📋 JSON</button>
        <button class="btn sm export-md-btn" data-chatid="${chat.id}" title="Download">⬇️</button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.chat-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.chat-actions')) return;
      openChatDetail(item.dataset.chatid, setCurrentChatId); // IDをセットして詳細を開く
    });
  });

  container.querySelectorAll('.copy-md-btn').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); copyChat(btn.dataset.chatid, 'markdown'); });
  });

  container.querySelectorAll('.copy-json-btn').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); copyChat(btn.dataset.chatid, 'json'); });
  });

  container.querySelectorAll('.export-md-btn').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); exportChat(btn.dataset.chatid, 'markdown'); });
  });
}

async function copyChat(chatId, format) {
  const chatData = await GemLogStorage.getChat(chatId);
  if (!chatData) return showToast(chrome.i18n.getMessage("errDataNotFound"));
  let content = format === 'markdown' ? GemLogStorage.chatToMarkdown(chatData) : GemLogStorage.chatToJSON(chatData);
  try {
    await navigator.clipboard.writeText(content);
    showToast(`${format === 'markdown' ? 'Markdown' : 'JSON'} ${chrome.i18n.getMessage("toastCopied")}`);
  } catch (err) {
    showToast(chrome.i18n.getMessage("toastCopyFailed"));
  }
}

async function exportChat(chatId, format) {
  const chatData = await GemLogStorage.getChat(chatId);
  if (!chatData) return showToast(chrome.i18n.getMessage("errDataNotFound"));
  const safeName = (chatData.title || 'chat').replace(/[\/\\:*?"<>|]/g, '_').substring(0, 50);
  const timestamp = new Date().toISOString().split('T')[0];
  if (format === 'markdown') {
    downloadFile(`${safeName}_${timestamp}.md`, GemLogStorage.chatToMarkdown(chatData), 'text/markdown');
  } else {
    downloadFile(`${safeName}_${timestamp}.json`, GemLogStorage.chatToJSON(chatData), 'application/json');
  }
  showToast(`${format === 'markdown' ? 'Markdown' : 'JSON'} ${chrome.i18n.getMessage("toastExported")}`);
}

// ========== 設定関連 ==========
async function loadSettings() {
  const settings = await GemLogStorage.getSettings();
  document.getElementById('loggingMode').value = settings.loggingMode;
  document.getElementById('apiProvider').value = settings.apiProvider;
  document.getElementById('apiKey').value = settings.apiKey || '';
  document.getElementById('apiModel').value = settings.apiModel || '';
  document.getElementById('apiEndpoint').value = settings.apiEndpoint || '';
  toggleApiFields(settings.apiProvider);
  renderManagedList(updateCurrentChatAction, renderChatList);
}

async function saveSettings() {
  const settings = {
    loggingMode: document.getElementById('loggingMode').value,
    apiProvider: document.getElementById('apiProvider').value,
    apiKey: document.getElementById('apiKey').value,
    apiModel: document.getElementById('apiModel').value,
    apiEndpoint: document.getElementById('apiEndpoint').value
  };
  await GemLogStorage.saveSettings(settings);
  showToast(chrome.i18n.getMessage("toastSettingsSaved"));
  renderManagedList(updateCurrentChatAction, renderChatList);
}

// ========== Content Script との連携 ==========
async function checkContentScriptStatus() {
  const dot = document.getElementById('statusDot');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url?.includes('gemini.google.com')) {
      dot.classList.remove('active');
      dot.title = 'Inactive';
      return;
    }
    chrome.tabs.sendMessage(tab.id, { action: 'getStatus' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        dot.classList.remove('active');
        dot.title = 'Disconnected';
      } else {
        dot.classList.add('active');
        dot.title = `Active: ${response.processedTurns} turns logged`;
      }
    });
  } catch {
    dot.classList.remove('active');
  }
}

async function updateCurrentChatAction() {
  const statusArea = document.getElementById('currentChatStatus');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url?.includes('gemini.google.com')) {
    statusArea.style.display = 'none';
    return;
  }
  chrome.tabs.sendMessage(tab.id, { action: 'getStatus' }, async (response) => {
    if (chrome.runtime.lastError || !response || !response.chatId) return;
    const chatId = response.chatId;
    const settings = await GemLogStorage.getSettings();
    const btn = document.getElementById('toggleLoggingBtn');
    const badge = document.getElementById('loggingBadge');
    const autoScrollBtn = document.getElementById('autoScrollBtn');
    
    statusArea.style.display = 'block';
    const isIncluded = settings.whitelist ? settings.whitelist.includes(chatId) : false;
    const isExcluded = settings.blacklist ? settings.blacklist.includes(chatId) : false;
    let isLogging = false;

    if (settings.loggingMode === 'whitelist') {
      isLogging = isIncluded;
      btn.style.display = 'block';
      btn.textContent = isIncluded ? chrome.i18n.getMessage("btnStopLogging") : chrome.i18n.getMessage("btnStartLogging");
      btn.className = isIncluded ? 'btn sm danger' : 'btn sm primary';
      badge.textContent = isIncluded ? chrome.i18n.getMessage("badgeRecording") : chrome.i18n.getMessage("badgeUnrecorded");
      badge.style.background = isIncluded ? 'var(--success)' : 'var(--border)';
    } else if (settings.loggingMode === 'blacklist') {
      isLogging = !isExcluded;
      btn.style.display = 'block';
      btn.textContent = isExcluded ? chrome.i18n.getMessage("btnResumeLogging") : chrome.i18n.getMessage("btnExcludeChat");
      btn.className = isExcluded ? 'btn sm primary' : 'btn sm danger';
      badge.textContent = isExcluded ? chrome.i18n.getMessage("badgeExcluded") : chrome.i18n.getMessage("badgeRecording");
      badge.style.background = isExcluded ? 'var(--danger)' : 'var(--success)';
    } else {
      isLogging = true;
      btn.style.display = 'none';
      badge.textContent = chrome.i18n.getMessage("badgeRecording");
      badge.style.background = 'var(--success)';
    }

    btn.onclick = async () => {
      const listType = settings.loggingMode === 'whitelist' ? 'whitelist' : 'blacklist';
      await GemLogStorage.toggleChatInList(listType, chatId);
      showToast(chrome.i18n.getMessage("toastSettingsUpdated"));
      if (settings.loggingMode === 'whitelist' && !isIncluded) {
        chrome.tabs.sendMessage(tab.id, { action: 'forceScan' });
      }
      updateCurrentChatAction();
      renderChatList();
    };

    if (isLogging) {
      autoScrollBtn.style.display = 'block';
      autoScrollBtn.onclick = () => {
        chrome.tabs.sendMessage(tab.id, { action: 'autoScroll' });
        window.close();
      };
    } else {
      autoScrollBtn.style.display = 'none';
    }
  }); 
}

// ========== Event Listeners ==========
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

document.getElementById('refreshBtn').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url?.includes('gemini.google.com')) {
      chrome.tabs.sendMessage(tab.id, { action: 'forceScan' });
      showToast(chrome.i18n.getMessage("toastRescanned"));
    }
  } catch { }
  await renderChatList();
  await updateStorageUsage();
  await checkContentScriptStatus();
  updateCurrentChatAction();
});

document.getElementById('backBtn').addEventListener('click', () => {
  switchTab('chats');
  renderChatList();
});

document.getElementById('copyMdBtnDetail').addEventListener('click', () => {
  if (currentChatId) copyChat(currentChatId, 'markdown');
});

document.getElementById('copyJsonBtnDetail').addEventListener('click', () => {
  if (currentChatId) copyChat(currentChatId, 'json');
});

// APIマネージャーの呼び出し
document.getElementById('summarizeBtn').addEventListener('click', () => {
  summarizeCurrentChat(currentChatId, () => switchTab('settings'));
});
document.getElementById('copySummaryBtn').addEventListener('click', copySummary);

document.getElementById('deleteChatBtn').addEventListener('click', async () => {
  if (!currentChatId) return;
  if (!confirm(chrome.i18n.getMessage("confirmDeleteChat"))) return;
  await GemLogStorage.deleteChat(currentChatId);
  showToast(chrome.i18n.getMessage("toastChatDeleted"));
  switchTab('chats');
  renderChatList();
  updateStorageUsage();
});

document.getElementById('loggingMode').addEventListener('change', () => {
  renderManagedList(updateCurrentChatAction, renderChatList);
});

document.getElementById('apiProvider').addEventListener('change', (e) => {
  toggleApiFields(e.target.value);
});

document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);

document.getElementById('deleteAllBtn').addEventListener('click', async () => {
  if (!confirm(chrome.i18n.getMessage("confirmDeleteAll"))) return;
  if (!confirm(chrome.i18n.getMessage("confirmDeleteAllReally"))) return;
  await GemLogStorage.deleteAllChats();
  showToast(chrome.i18n.getMessage("toastAllDeleted"));
  renderChatList();
  updateStorageUsage();
});

// ========== Initialize ==========
async function init() {
  applyTranslations(); // i18nの初期化
  await renderChatList();
  await updateStorageUsage();
  await loadSettings();
  await checkContentScriptStatus();
  updateCurrentChatAction();
}

init();
/**
 * UI Manager
 * タブの切り替え、チャットリストの描画、詳細画面の表示など
 * HTML（DOM）の操作を専門に行うモジュール
 */

import { formatDate, escapeHtml, showToast } from './utils.js';
import { copySummary, summarizeCurrentChat } from './api-manager.js';

// ========== タブ切り替え ==========
export function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));

  const tab = document.querySelector(`.tab[data-tab="${tabName}"]`);
  const panel = document.getElementById('panel' + tabName.charAt(0).toUpperCase() + tabName.slice(1));

  if (tab) tab.classList.add('active');
  if (panel) panel.classList.add('active');

  const detailTab = document.getElementById('detailTab');
  if (tabName === 'detail') {
    detailTab.style.display = '';
  } else if (tabName === 'chats') {
    detailTab.style.display = 'none';
  }
}

// ========== ストレージバーの更新 ==========
export async function updateStorageUsage() {
  const usage = await GemLogStorage.getStorageUsage();
  document.getElementById('storageUsage').textContent = `${usage.usedMB} MB`;
  const percent = Math.min((usage.usedBytes / (100 * 1024 * 1024)) * 100, 100);
  document.getElementById('storageBar').style.width = `${percent}%`;
}

// ========== 設定画面の表示切替 ==========
export function toggleApiFields(provider) {
  const apiFields = document.getElementById('apiFields');
  const endpointGroup = document.getElementById('endpointGroup');

  if (provider === 'none') {
    apiFields.style.display = 'none';
  } else {
    apiFields.style.display = 'block';
    endpointGroup.style.display = provider === 'custom' ? 'block' : 'none';
  }
}

// ========== チャット詳細画面を開く ==========
export async function openChatDetail(chatId, setCurrentChatIdCallback) {
  setCurrentChatIdCallback(chatId); // メインの変数にIDをセット
  const chatData = await GemLogStorage.getChat(chatId);

  if (!chatData) {
    showToast(chrome.i18n.getMessage("errChatNotFound"));
    return;
  }

  document.getElementById('detailTitle').textContent = chatData.title || chrome.i18n.getMessage("untitledChat");
  document.getElementById('summaryArea').style.display = 'none';

  const preview = document.getElementById('messagePreview');
  preview.innerHTML = chatData.messages.map(msg => {
    const roleClass = msg.role === 'model' ? 'model' : '';
    const roleLabel = msg.role === 'user' ? '👤 User' : '✨ Gemini';
    const truncated = msg.content.length > 200 ? msg.content.substring(0, 200) + '...' : msg.content;

    let codeInfo = '';
    if (msg.codeBlocks && msg.codeBlocks.length > 0) {
      codeInfo = `<div style="font-size:10px;color:var(--accent);margin-top:2px;">📝 ${chrome.i18n.getMessage("codeBlock")} ${msg.codeBlocks.length}${chrome.i18n.getMessage("itemCount")}</div>`;
    }

    return `
      <div class="msg">
        <div class="msg-role ${roleClass}">${roleLabel}</div>
        <div class="msg-content">${escapeHtml(truncated)}</div>
        ${codeInfo}
      </div>`;
  }).join('');

  switchTab('detail');
}

// ========== ホワイト/ブラックリストの描画 ==========
export async function renderManagedList(updateCurrentChatActionCallback, renderChatListCallback) {
  const mode = document.getElementById('loggingMode').value;
  const settings = await GemLogStorage.getSettings();
  const area = document.getElementById('listManagementArea');
  const label = document.getElementById('listManagementLabel');
  const listContainer = document.getElementById('managedList');

  if (mode === 'all') {
    area.style.display = 'none';
    return;
  }

  area.style.display = 'block';
  label.textContent = mode === 'whitelist' ? chrome.i18n.getMessage("listLabelWhitelist") : chrome.i18n.getMessage("listLabelBlacklist");

  const targetIds = settings[mode] || [];
  if (targetIds.length === 0) {
    listContainer.innerHTML = `<div style="padding:8px; color:var(--text-dim); text-align:center; font-size:11px;">${chrome.i18n.getMessage("msgListEmpty")}</div>`;
    return;
  }

  const index = await GemLogStorage.getChatIndex();

  listContainer.innerHTML = targetIds.map(id => {
    const title = index[id] ? index[id].title : `ID: ${id.substring(0, 10)}...`;
    return `
      <div class="chat-item" style="padding: 6px 8px; margin-bottom: 4px; display:flex; justify-content:space-between; align-items:center; min-height: 32px;">
        <div class="chat-title" style="flex:1; margin-right:8px; font-size:11px;">${escapeHtml(title)}</div>
        <button class="btn danger sm remove-list-btn" data-id="${id}" style="padding: 2px 6px;">${chrome.i18n.getMessage("btnRemove")}</button>
      </div>
    `;
  }).join('');

  listContainer.querySelectorAll('.remove-list-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const id = btn.dataset.id;
      await GemLogStorage.toggleChatInList(mode, id);
      showToast(chrome.i18n.getMessage("toastRemovedFromList"));
      
      // コールバックで画面を再描画
      renderManagedList(updateCurrentChatActionCallback, renderChatListCallback); 
      if (renderChatListCallback) renderChatListCallback(); 
      if (updateCurrentChatActionCallback) updateCurrentChatActionCallback();
    });
  });
}
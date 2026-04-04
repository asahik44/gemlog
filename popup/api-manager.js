/**
 * API Manager
 * 要約生成のAPI通信と、要約結果のコピー処理を担当
 */

// さっき作った utils.js から必要なツールを読み込む（インポート）
import { showToast } from './utils.js';

// 要約を実行する関数
export async function summarizeCurrentChat(currentChatId, switchToSettingsCallback) {
  if (!currentChatId) return;

  const settings = await GemLogStorage.getSettings();
  
  // APIが設定されていない場合
  if (settings.apiProvider === 'none' || !settings.apiKey) {
    showToast(chrome.i18n.getMessage("errApiNotConfigured"));
    if (switchToSettingsCallback) switchToSettingsCallback(); // 設定タブへ飛ばす
    return;
  }

  const chatData = await GemLogStorage.getChat(currentChatId);
  if (!chatData) {
    showToast(chrome.i18n.getMessage("errDataNotFound"));
    return;
  }

  const summaryArea = document.getElementById('summaryArea');
  const summaryText = document.getElementById('summaryText');
  const copyBtn = document.getElementById('copySummaryBtn');
  
  summaryArea.style.display = 'block';
  copyBtn.style.display = 'none';
  summaryText.textContent = chrome.i18n.getMessage("msgGeneratingSummary");

  try {
    // background.js にAPIリクエストを丸投げする
    const response = await chrome.runtime.sendMessage({
      action: 'summarize',
      chatData: chatData,
      settings: settings
    });

    if (response.success) {
      summaryText.textContent = response.summary;
      copyBtn.style.display = 'block';
    } else {
      summaryText.textContent = `Error: ${response.error}`;
    }
  } catch (error) {
    summaryText.textContent = `Error: ${error.message}`;
  }
}

// 要約をクリップボードにコピーする関数
export async function copySummary() {
  const summaryText = document.getElementById('summaryText').textContent;
  if (!summaryText || summaryText === chrome.i18n.getMessage("msgGeneratingSummary")) return;
  
  try {
    await navigator.clipboard.writeText(summaryText);
    showToast(chrome.i18n.getMessage("toastSummaryCopied"));
  } catch (err) {
    showToast(chrome.i18n.getMessage("toastCopyFailed"));
  }
}
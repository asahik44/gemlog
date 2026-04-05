/**
 * GemLog Content Script
 * Geminiのチャット画面をMutationObserverで監視し、新しいメッセージを記録・遡り取得
 */
(function () {
  'use strict';

  if (window.__gemlog_initialized) return;
  window.__gemlog_initialized = true;

  const LOG_PREFIX = '[GemLog]';
  let currentChatId = null;
  let observer = null;
  let processedTurns = new Set();

  function getChatIdFromURL() {
    const match = location.pathname.match(/\/app\/([a-f0-9]+)/);
    return match ? match[1] : location.pathname.replace(/\//g, '_') || 'unknown';
  }

  function getChatTitle() {
    const preciseTitle = document.querySelector('[data-test-id="conversation-title"]');
    if (preciseTitle) {
      const text = preciseTitle.textContent.trim();
      if (text && !['Gemini', 'Google Gemini'].includes(text)) return text;
    }
    const pageTitle = document.title.replace(/\s*[-–]\s*Gemini$/i, '').replace(/\s*[-–]\s*Google$/i, '').replace(/^Gemini\s*[-–]?\s*/, '').trim();
    if (pageTitle && !['Gemini', 'Google Gemini'].includes(pageTitle) && pageTitle.length > 0) return pageTitle;
    return `Chat ${new Date().toLocaleDateString('ja-JP')}`;
  }

  function extractUserQuery(container) {
    const lines = container.querySelectorAll('.query-text-line');
    if (lines.length > 0) return Array.from(lines).map(l => l.textContent.trim()).filter(Boolean).join('\n');
    const queryText = container.querySelector('.query-text');
    if (queryText) return queryText.textContent.trim();
    return '';
  }

  function extractUserImages(container) {
    const imgs = container.querySelectorAll('user-query-file-preview img[data-test-id="uploaded-img"]');
    return Array.from(imgs).map(img => img.src).filter(Boolean);
  }

  function extractModelResponse(container) {
    const markdownEl = container.querySelector('message-content .markdown');
    if (!markdownEl) return '';
    const clone = markdownEl.cloneNode(true);
    clone.querySelectorAll('code-block').forEach((cb, i) => {
      const placeholder = document.createElement('span');
      placeholder.textContent = `[CODE_BLOCK_${i}]`;
      cb.replaceWith(placeholder);
    });
    clone.querySelectorAll('mini-app, response-element').forEach(el => el.textContent = '[Interactive Widget]');
    return clone.textContent.trim();
  }

  function extractCodeBlocks(container) {
    const blocks = [];
    container.querySelectorAll('code-block').forEach(cb => {
      const codeEl = cb.querySelector('code[data-test-id="code-content"]');
      const langEl = cb.querySelector('.code-block-decoration span');
      if (codeEl) blocks.push({ language: langEl ? langEl.textContent.trim().toLowerCase() : '', content: codeEl.textContent.trim() });
    });
    return blocks;
  }

  async function processConversationContainer(container) {
    const turnId = container.id;
    if (!turnId || processedTurns.has(turnId)) return;
    const shouldLog = await GemLogStorage.shouldLog(currentChatId);
    if (!shouldLog) return;

    const userQueryEl = container.querySelector('user-query');
    const modelResponseEl = container.querySelector('model-response');

    if (userQueryEl) {
      const text = extractUserQuery(userQueryEl);
      if (text) {
        // ★修正: 変数に入れて2回実行されるのを防ぐ
        const images = extractUserImages(userQueryEl);
        await GemLogStorage.saveMessage(currentChatId, getChatTitle(), { 
          turnId, 
          role: 'user', 
          content: text, 
          images: images.length > 0 ? images : undefined, 
          timestamp: new Date().toISOString() 
        });
      }
    }

    if (modelResponseEl) {
      const responseContainer = modelResponseEl.querySelector('response-container');
      if (!responseContainer || responseContainer.querySelector('[aria-busy="true"]')) return;
      const text = extractModelResponse(modelResponseEl);
      if (text) {
        // ★修正: こちらも変数に入れて最適化
        const codeBlocks = extractCodeBlocks(modelResponseEl);
        const saved = await GemLogStorage.saveMessage(currentChatId, getChatTitle(), { 
          turnId, 
          role: 'model', 
          content: text, 
          codeBlocks: codeBlocks.length > 0 ? codeBlocks : undefined, 
          timestamp: new Date().toISOString() 
        });
        if (saved) processedTurns.add(turnId);
      }
    }
  }

  async function scanExistingConversations() {
    const containers = Array.from(document.querySelectorAll('.conversation-container'));
    for (const container of containers) {
      await processConversationContainer(container);
    }
    // ★追加：スキャン完了後、DOMの順番通りにストレージ内の配列をソートする
    const turnIds = containers.map(c => c.id).filter(Boolean);
    if (turnIds.length > 0 && currentChatId) {
      await GemLogStorage.syncDOMOrder(currentChatId, turnIds);
    }
  }

  // --- UI Notification ---
  function showPageToast(msg) {
    let toast = document.getElementById('gemlog-page-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'gemlog-page-toast';
      toast.style.cssText = 'position:fixed; top:24px; left:50%; transform:translateX(-50%); background:#1a73e8; color:white; padding:12px 24px; border-radius:30px; z-index:9999; font-weight:bold; font-size:14px; box-shadow:0 4px 12px rgba(0,0,0,0.2); transition:opacity 0.3s;';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
  }
  function hidePageToast() {
    const toast = document.getElementById('gemlog-page-toast');
    if (toast) toast.style.opacity = '0';
  }

  // --- Auto Scroll Logic ---
  async function autoScrollToTop() {
    const scroller = document.querySelector('infinite-scroller.chat-history') || document.querySelector('.chat-history') || document.documentElement;
    
    // ★修正: 多言語対応
    showPageToast(chrome.i18n.getMessage("toastAutoScrollStart"));
    
    let lastHeight = scroller.scrollHeight;
    let retries = 0;

    const runScroll = async () => {
      scroller.scrollTop = 0; 
      await new Promise(r => setTimeout(r, 1200)); 

      if (scroller.scrollHeight === lastHeight) {
        retries++;
        if (retries >= 3) {
          // ★修正: 多言語対応
          showPageToast(chrome.i18n.getMessage("toastAutoScrollReachedTop"));
          
          await GemLogStorage.clearChatMessages(currentChatId);
          processedTurns.clear();
          await scanExistingConversations();
          
          // ★修正: 多言語対応
          showPageToast(chrome.i18n.getMessage("toastAutoScrollDone"));
          setTimeout(hidePageToast, 4000);
          return; 
        }
      } else {
        retries = 0;
        lastHeight = scroller.scrollHeight;
        // ★修正: 多言語対応
        showPageToast(chrome.i18n.getMessage("toastAutoScrollProgress") + lastHeight + "px)");
      }
      
      setTimeout(runScroll, 300);
    };

    setTimeout(runScroll, 0);
  }

  // --- Observers ---
  function startObserver() {
    const chatContainer = document.querySelector('infinite-scroller.chat-history');
    if (!chatContainer) return setTimeout(startObserver, 2000);
    if (observer) observer.disconnect();

    observer = new MutationObserver(async (mutations) => {
      let shouldSyncOrder = false;
      for (const mutation of mutations) {
        if (mutation.type !== 'childList') continue;
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (node.classList?.contains('conversation-container')) {
            await processConversationContainer(node);
            shouldSyncOrder = true;
          }
          const containers = node.querySelectorAll?.('.conversation-container');
          if (containers && containers.length > 0) {
            for (const c of containers) await processConversationContainer(c);
            shouldSyncOrder = true;
          }
          if (node.tagName === 'MESSAGE-CONTENT' || node.classList?.contains('response-content') || node.querySelector?.('message-content')) {
            const container = node.closest('.conversation-container');
            if (container && container.id && !processedTurns.has(container.id)) {
              setTimeout(() => { processConversationContainer(container); scanExistingConversations(); }, 500);
            }
          }
        }
      }
      // 手動で上にスクロールして過去分が読み込まれた場合、順番をソートする
      if (shouldSyncOrder) setTimeout(scanExistingConversations, 500);
    });
    observer.observe(chatContainer, { childList: true, subtree: true });
    scanExistingConversations();
  }

  function startBusyObserver() {
    const busyObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'aria-busy') {
          if (mutation.target.getAttribute('aria-busy') === 'false') {
            const container = mutation.target.closest('.conversation-container');
            if (container && container.id && !processedTurns.has(container.id)) {
              setTimeout(() => { processConversationContainer(container); scanExistingConversations(); }, 300);
            }
          }
        }
      }
    });
    const chatArea = document.querySelector('infinite-scroller.chat-history');
    if (chatArea) busyObserver.observe(chatArea, { attributes: true, attributeFilter: ['aria-busy'], subtree: true });
  }

  function watchURLChanges() {
    let lastURL = location.href;
    new MutationObserver(() => {
      if (location.href !== lastURL) {
        lastURL = location.href;
        currentChatId = getChatIdFromURL();
        processedTurns.clear();
        setTimeout(scanExistingConversations, 1000);
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getStatus') {
      sendResponse({ active: true, chatId: currentChatId, processedTurns: processedTurns.size });
    } else if (request.action === 'forceScan') {
      scanExistingConversations().then(() => sendResponse({ success: true }));
    } else if (request.action === 'autoScroll') {
      autoScrollToTop();
      sendResponse({ success: true });
    }
    return true;
  });

  function init() {
    currentChatId = getChatIdFromURL();
    const initObserver = new MutationObserver((_, obs) => {
      if (document.querySelector('infinite-scroller.chat-history')) {
        obs.disconnect();
        startObserver();
        startBusyObserver();
      }
    });
    if (document.querySelector('infinite-scroller.chat-history')) {
      startObserver();
      startBusyObserver();
    } else {
      initObserver.observe(document.body, { childList: true, subtree: true });
    }
    watchURLChanges();
  }

  init();
})();
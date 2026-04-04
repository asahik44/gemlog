/**
 * GemLog Storage Manager
 * チャットログの保存・取得・削除を管理
 */
class GemLogStorage {
  static SETTINGS_KEY = 'gemlog_settings';
  static CHAT_INDEX_KEY = 'gemlog_chat_index';
  static CHAT_PREFIX = 'gemlog_chat_';

  // デフォルト設定
  static DEFAULT_SETTINGS = {
    loggingMode: 'all', // 'all' | 'whitelist' | 'blacklist'
    whitelist: [],
    blacklist: [],
    apiProvider: 'none', // 'none' | 'google' | 'openai' | 'anthropic' | 'custom'
    apiKey: '',
    apiModel: '',
    apiEndpoint: '',
    exportFormat: 'markdown' // 'markdown' | 'json'
  };

  /**
   * 設定を取得
   */
  static async getSettings() {
    const result = await chrome.storage.local.get(this.SETTINGS_KEY);
    return { ...this.DEFAULT_SETTINGS, ...(result[this.SETTINGS_KEY] || {}) };
  }

  /**
   * 設定を保存
   */
  static async saveSettings(settings) {
    await chrome.storage.local.set({
      [this.SETTINGS_KEY]: { ...this.DEFAULT_SETTINGS, ...settings }
    });
  }

  /**
   * チャットインデックスを取得（全チャットのメタデータ一覧）
   */
  static async getChatIndex() {
    const result = await chrome.storage.local.get(this.CHAT_INDEX_KEY);
    return result[this.CHAT_INDEX_KEY] || {};
  }

  /**
   * チャットデータを取得
   */
  static async getChat(chatId) {
    const key = this.CHAT_PREFIX + chatId;
    const result = await chrome.storage.local.get(key);
    return result[key] || null;
  }

  /**
   * チャットデータを保存（メッセージ追加）
   */
  static async saveMessage(chatId, chatTitle, message) {
    const key = this.CHAT_PREFIX + chatId;
    const existing = await this.getChat(chatId);

    const chatData = existing || {
      id: chatId,
      title: chatTitle,
      created: new Date().toISOString(),
      messages: []
    };

    // タイトルが「Google Gemini」やデフォルト値の場合、より良いタイトルで更新
    const genericTitles = ['Google Gemini', 'Gemini', 'Untitled', ''];
    if (chatTitle && !genericTitles.includes(chatTitle) &&
        (!chatData.title || genericTitles.includes(chatData.title) || chatData.title.startsWith('Chat '))) {
      chatData.title = chatTitle;
    }

    // 重複チェック（同じturnIdがあればスキップ）
    const exists = chatData.messages.some(m => m.turnId === message.turnId && m.role === message.role);
    if (exists) return false;

    chatData.messages.push(message);
    chatData.updated = new Date().toISOString();
    chatData.messageCount = chatData.messages.length;

    // チャットデータ保存
    await chrome.storage.local.set({ [key]: chatData });

    // インデックス更新
    const index = await this.getChatIndex();
    index[chatId] = {
      id: chatId,
      title: chatTitle,
      created: chatData.created,
      updated: chatData.updated,
      messageCount: chatData.messageCount
    };
    await chrome.storage.local.set({ [this.CHAT_INDEX_KEY]: index });

    return true;
  }

  /**
   * チャットを削除
   */
  static async deleteChat(chatId) {
    const key = this.CHAT_PREFIX + chatId;
    await chrome.storage.local.remove(key);

    const index = await this.getChatIndex();
    delete index[chatId];
    await chrome.storage.local.set({ [this.CHAT_INDEX_KEY]: index });
  }

  /**
   * 全チャットを削除
   */
  static async deleteAllChats() {
    const index = await this.getChatIndex();
    const keys = Object.keys(index).map(id => this.CHAT_PREFIX + id);
    keys.push(this.CHAT_INDEX_KEY);
    await chrome.storage.local.remove(keys);
  }

  /**
   * ストレージ使用量を取得
   */
  static async getStorageUsage() {
    return new Promise((resolve) => {
      chrome.storage.local.getBytesInUse(null, (bytes) => {
        resolve({
          usedBytes: bytes,
          usedMB: (bytes / (1024 * 1024)).toFixed(2)
        });
      });
    });
  }

  /**
   * このチャットをログ対象とするか判定
   */
  static async shouldLog(chatId) {
    const settings = await this.getSettings();

    switch (settings.loggingMode) {
      case 'all':
        return !settings.blacklist.includes(chatId);
      case 'whitelist':
        return settings.whitelist.includes(chatId);
      case 'blacklist':
        return !settings.blacklist.includes(chatId);
      default:
        return true;
    }
  }

  /**
   * チャットデータをMarkdownに変換
   */
  static chatToMarkdown(chatData) {
    let md = `# ${chatData.title || 'Untitled Chat'}\n\n`;
    md += `- **Chat ID**: ${chatData.id}\n`;
    md += `- **Created**: ${chatData.created}\n`;
    md += `- **Updated**: ${chatData.updated}\n`;
    md += `- **Messages**: ${chatData.messageCount}\n\n---\n\n`;

    for (const msg of chatData.messages) {
      const roleLabel = msg.role === 'user' ? '👤 User' : '✨ Gemini';
      md += `## ${roleLabel}\n\n`;
      md += `${msg.content}\n\n`;

      if (msg.codeBlocks && msg.codeBlocks.length > 0) {
        for (const code of msg.codeBlocks) {
          md += `\`\`\`${code.language || ''}\n${code.content}\n\`\`\`\n\n`;
        }
      }

      if (msg.images && msg.images.length > 0) {
        for (const img of msg.images) {
          md += `![uploaded image](${img})\n\n`;
        }
      }

      md += `---\n\n`;
    }

    return md;
  }

  /**
   * チャットデータをJSON文字列に変換
   */
static chatToJSON(chatData) {
    return JSON.stringify(chatData, null, 2);
  }

  /**
   * 特定のチャットをリスト（whitelist/blacklist）に追加・削除
   */
  static async toggleChatInList(listType, chatId) {
    const settings = await this.getSettings();
    const list = settings[listType] || [];
    const index = list.indexOf(chatId);

    if (index === -1) {
      list.push(chatId); // リストにないなら追加
    } else {
      list.splice(index, 1); // リストにあるなら削除
    }

    settings[listType] = list;
    await this.saveSettings(settings);
    return index === -1; // 追加された場合はtrue、削除された場合はfalse
  }
  /**
   * チャットのメッセージ配列だけを空にする（過去ログ完全再取得用）
   */
  static async clearChatMessages(chatId) {
    const key = this.CHAT_PREFIX + chatId;
    const chatData = await this.getChat(chatId);
    if (chatData) {
      chatData.messages = [];
      chatData.messageCount = 0;
      await chrome.storage.local.set({ [key]: chatData });
    }
  }

  /**
   * メッセージの順番を画面（DOM）の表示順に合わせて並び替える
   */
  static async syncDOMOrder(chatId, turnIdsArray) {
    const key = this.CHAT_PREFIX + chatId;
    const chatData = await this.getChat(chatId);
    if (!chatData || !chatData.messages) return;

    chatData.messages.sort((a, b) => {
      const idxA = turnIdsArray.indexOf(a.turnId);
      const idxB = turnIdsArray.indexOf(b.turnId);
      
      if (idxA !== -1 && idxB !== -1) {
        if (idxA === idxB) {
          // 同じターンの場合、user(質問)を先、model(回答)を後にする
          if (a.role === 'user' && b.role !== 'user') return -1;
          if (a.role !== 'user' && b.role === 'user') return 1;
          return 0;
        }
        return idxA - idxB; // 画面の上にあるものほど配列の最初に来るように
      }
      return 0;
    });

    await chrome.storage.local.set({ [key]: chatData });
  }
} // ←★クラスの閉じカッコ（}）をここにする！

// content scriptとpopupの両方で使えるようにグローバルに公開
if (typeof window !== 'undefined') {
  window.GemLogStorage = GemLogStorage;
}

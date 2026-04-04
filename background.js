/**
 * GemLog Background Service Worker
 * API要約リクエストの処理とダウンロード管理
 */

// インストール時の初期設定
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.set({
      gemlog_settings: {
        loggingMode: 'all',
        whitelist: [],
        blacklist: [],
        apiProvider: 'none',
        apiKey: '',
        apiModel: '',
        apiEndpoint: '',
        exportFormat: 'markdown'
      }
    });
    console.log('[GemLog] Extension installed, default settings saved');
  }
});

/**
 * API要約リクエストを処理
 */
async function summarizeChat(chatData, settings) {
  const messages = chatData.messages.map(m => {
    const role = m.role === 'user' ? 'User' : 'Gemini';
    return `${role}: ${m.content}`;
  }).join('\n\n');

  const prompt = `以下はGeminiとのチャット履歴です。このやり取りの内容を簡潔に要約してください。
要約には以下を含めてください：
- メインテーマ
- 重要なポイント（3-5つ）
- 決定事項やアクション（あれば）
- コードやツールに関する情報（あれば）

チャット履歴:
${messages}`;

  let apiUrl, headers, body;

  switch (settings.apiProvider) {
    case 'google':
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${settings.apiModel || 'gemini-2.0-flash'}:generateContent?key=${settings.apiKey}`;
      headers = { 'Content-Type': 'application/json' };
      body = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      });
      break;

    case 'openai':
      apiUrl = 'https://api.openai.com/v1/chat/completions';
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      };
      body = JSON.stringify({
        model: settings.apiModel || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000
      });
      break;

    case 'anthropic':
      apiUrl = 'https://api.anthropic.com/v1/messages';
      headers = {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      };
      body = JSON.stringify({
        model: settings.apiModel || 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      });
      break;

    case 'custom':
      apiUrl = settings.apiEndpoint;
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      };
      body = JSON.stringify({
        model: settings.apiModel,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000
      });
      break;

    default:
      throw new Error('API provider not configured');
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  // レスポンスからテキストを抽出
  switch (settings.apiProvider) {
    case 'google':
      return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
    case 'openai':
    case 'custom':
      return data.choices?.[0]?.message?.content || 'No response';
    case 'anthropic':
      return data.content?.[0]?.text || 'No response';
    default:
      return 'Unknown provider';
  }
}

/**
 * メッセージハンドラ
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'summarize') {
    summarizeChat(request.chatData, request.settings)
      .then(summary => sendResponse({ success: true, summary }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // 非同期レスポンスのため
  }
});

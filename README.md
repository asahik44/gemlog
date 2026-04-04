# 📋 GemLog - The Ultimate Gemini Chat Logger

[English](#english) | [日本語](#japanese)

---

<a id="english"></a>
## 🚀 Overview
**GemLog** is a powerful Chrome extension that seamlessly runs in the background to automatically log, manage, and extract your Google Gemini chat histories. 

Never lose a valuable prompt or insight again. Export your chats in clean Markdown or JSON, manage which conversations to keep, and even generate instant AI summaries of your long discussions using your favorite LLM APIs.

## ✨ Key Features
* **📝 Seamless Auto-Logging**: Automatically records your Gemini conversations in real-time using lightweight DOM observation.
* **🗂️ Flexible Logging Modes**:
  * **Log All**: Save everything automatically.
  * **Whitelist**: Only log specific chats you explicitly choose.
  * **Blacklist**: Log everything except the chats you want to keep private.
* **📥 Export to MD / JSON**: One-click copy or download of your chats in beautifully formatted Markdown or structured JSON.
* **📜 Auto-Fetch History**: One-click magic button to automatically scroll and capture the entire history of long, ongoing chats.
* **🤖 AI Summarization**: Connect your API keys (OpenAI, Anthropic, Google Gemini, or Custom) to generate and copy instant summaries of your chats.
* **🌍 Multi-language Support**: Fully supports English and Japanese (i18n).
* **🔒 Privacy First**: All chat logs and API keys are stored **strictly locally** on your browser (`chrome.storage.local`). No external databases, no telemetry.

## 🛠️ Installation (Developer Mode)
1. Clone or download this repository.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **"Developer mode"** in the top right corner.
4. Click **"Load unpacked"** and select the folder containing this extension.
5. Open [Google Gemini](https://gemini.google.com/) and click the GemLog icon in your toolbar!

## 💻 Tech Stack
* Vanilla JavaScript (ES Modules)
* Chrome Extension Manifest V3
* `chrome.storage.local` with `unlimitedStorage`
* `MutationObserver` for real-time DOM tracking

---

<a id="japanese"></a>
## 🚀 概要 (Overview)
**GemLog** は、Google Geminiでのチャット履歴をバックグラウンドで自動的に記録・管理し、MarkdownやJSON形式で抽出できる強力なChrome拡張機能です。

大切なプロンプトやAIからの回答を二度と失うことはありません。チャットの記録モードを柔軟に切り替え、長大な会話を外部APIを使って一瞬で要約することも可能です。

## ✨ 主な機能 (Key Features)
* **📝 完全自動ロギング**: Geminiのチャット画面を監視し、リアルタイムに会話をローカル保存します。
* **🗂️ 柔軟な記録モード**:
  * **全記録**: すべてのチャットを自動保存。
  * **ホワイトリスト**: 指定した重要なチャットのみを記録。
  * **ブラックリスト**: 指定したチャット「以外」をすべて記録。
* **📥 MD / JSON エクスポート**: 美しく整形されたMarkdownやJSONフォーマットで、1クリックでコピーまたはダウンロード可能。
* **📜 過去ログ自動取得**: 長いチャット履歴でも、ボタン1つで自動スクロールして全会話を再取得・構築します。
* **🤖 AI 要約機能**: OpenAI, Anthropic, Google GeminiなどのAPIキーを登録することで、長大なチャットの文脈をワンクリックで要約し、クリップボードにコピーできます。
* **🌍 多言語対応**: 日本語と英語のUIに完全対応（i18n）。
* **🔒 プライバシー最優先**: チャット履歴やAPIキーは**すべてブラウザのローカルストレージ内にのみ保存**されます。外部サーバーへの送信やデータ収集は一切行いません。

## 🛠️ インストール方法 (開発者モード)
1. このリポジトリをクローンまたはダウンロード（ZIP解凍）します。
2. Chromeを開き、`chrome://extensions/` にアクセスします。
3. 右上の **「デベロッパー モード」** をオンにします。
4. **「パッケージ化されていない拡張機能を読み込む」** をクリックし、解凍したフォルダを選択します。
5. [Google Gemini](https://gemini.google.com/) を開き、拡張機能アイコンから GemLog を起動してください！

## 📄 License
MIT License
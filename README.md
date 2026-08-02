# 📚 BookScan - Googleスプレッドシート & OpenBD 蔵書管理アプリ

Androidスマホのカメラで書籍のISBNバーコードを読み取り、OpenBD APIから書誌情報を自動取得してGoogleスプレッドシート（A列:ISBN～G列:処分日）へ自動追記・管理できるアプリです。

---

## 🚀 GitHub Pages 公開＆セットアップ手順

### 1. GitHub リポジトリの作成と Push
1. GitHub にて新しいリポジトリ（例: `bookscan`）を作成します。
2. 本フォルダの全ファイルをリポジトリに push します：
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/あなたのユーザー名/bookscan.git
   git push -u origin main
   ```

### 2. GitHub Pages の有効化
1. リポジトリの **Settings > Pages** を開きます。
2. **Build and deployment > Source** で **`GitHub Actions`** を選択します。
3. 自動デプロイが開始され、数秒で以下のURLで公開されます：
   `https://<あなたのユーザー名>.github.io/bookscan/`

---

## 📱 Androidスマホでの利用手順

1. Androidスマホの Chrome ブラウザで `https://<あなたのユーザー名>.github.io/bookscan/` にアクセスします。
2. ブラウザメニュー（右上3点リーダー）を開き、**「ホーム画面に追加」** をタップします。
3. ホーム画面の「BookScan」アイコンからアプリ感覚で全画面起動し、カメラでバーコードをスキャンできます。

---

## 📊 Googleスプレッドシートの列定義 (A~G列)

| 列 | 項目 | 動作 |
|---|---|---|
| A列 | ISBN | バーコード読み取り値 |
| B列 | タイトル | OpenBD APIより自動取得 |
| C列 | 著者名 | OpenBD APIより自動取得 |
| D列 | 出版社名 | OpenBD APIより自動取得 |
| E列 | 発行日 | OpenBD APIより自動取得 |
| F列 | **登録日** | **自動設定** (`YYYY/MM/DD`) |
| G列 | **処分日** | **手動枠** (デフォルト空欄) |

---

## ⚙️ Google Apps Script (GAS) 設定
1. Googleスプレッドシートを作成し、`Code.gs` の内容を Apps Script エディタにコピーします。
2. 「デプロイ」>「新しいデプロイ」でウェブアプリ（アクセス権限: **全員**）として公開します。
3. 発行された URL をアプリ右上のギア設定に入力してください。

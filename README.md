# 📚 BookScan 蔵書管理アプリ (app_260812 最新版)

Androidスマホのカメラで書籍の**ISBNバーコード**、またはバーコードの無い本に印刷された**「ISBN 978...」の文字（OCR文字認識）**を読み取り、OpenBD APIから書誌情報を自動取得してGoogleスプレッドシート（A:ISBN ～ G:処分日）へ自動追記・検索管理できるアプリです。

---

## 🌐 GitHub Pages 公開手順

### ステップ 1: GitHub リポジトリヘ Push
本フォルダの内容を GitHub リポジトリに push します：

```bash
git init
git add .
git commit -m "Deploy app_260812"
git branch -M main
git remote add origin https://github.com/あなたのユーザー名/リポジトリ名.git
git push -u origin main
```

### ステップ 2: GitHub Pages のソース設定
1. GitHub のリポジトリ画面で **Settings > Pages** を開きます。
2. **Build and deployment > Source** で **`GitHub Actions`** を選択します。
3. 数秒後に全自動でデプロイされ、以下のURLで公開されます：
   - **トップURL**: `https://<あなたのユーザー名>.github.io/<リポジトリ名>/`
   - **直接アクセス**: `https://<あなたのユーザー名>.github.io/<リポジトリ名>/app_260812/index_260812.html`

---

## 📱 AndroidスマホでのPWAアプリ化手順

1. Androidスマホの Chrome ブラウザで `https://<あなたのユーザー名>.github.io/<リポジトリ名>/` にアクセスします。
2. 右上メニュー（3点リーダー）から **「ホーム画面に追加」** または **「アプリをインストール」** をタップします。
3. ホーム画面のアイコンから起動し、カメラを起動して**バーコードスキャン** または **ISBN文字読み取り(OCR)** をご利用ください。

---

## 📊 Googleスプレッドシート列仕様 (A~G列)

- **A列**: ISBN
- **B列**: タイトル
- **C列**: 著者名
- **D列**: 出版社名
- **E列**: 発行日
- **F列**: **登録日** (`YYYY/MM/DD` 自動記録)
- **G列**: **処分日** (初期状態は空欄・手動入力枠)

---

## 📁 ディレクトリ構成

- `app_260812/`: **最新版アプリフォルダ** (バーコードスキャン + OCR文字読み取り + リアルタイム蔵書検索)
  - `index_260812.html`
  - `style_260812.css`
  - `app_260812.js`
  - `Code_260812.gs`
  - `manifest_260812.json`
  - `sw_260812.js`
  - `README_260812.md`
- `.github/workflows/deploy.yml`: GitHub Pages 自動デプロイ定義

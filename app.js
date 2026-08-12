/**
 * BookScan 蔵書管理 App JS (v260812 最新版)
 * バーコードスキャン & Tesseract.js OCR文字認識 & リアルタイム蔵書検索対応
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- 状態変数 ---
  let activeMode = 'barcode'; // 'barcode' または 'ocr'
  let html5QrCode = null;
  let isCameraScanning = false;
  let ocrVideoStream = null;
  let currentBookData = null;
  let allLoadedBooks = [];

  let gasUrl = localStorage.getItem('bookscan_gas_url') || '';

  // --- DOM要素 ---
  const modeBarcodeBtn = document.getElementById('mode-barcode');
  const modeOcrBtn = document.getElementById('mode-ocr');
  
  const btnToggleCamera = document.getElementById('btn-toggle-camera');
  const cameraBtnText = document.getElementById('camera-btn-text');
  
  const barcodeWrapper = document.getElementById('barcode-wrapper');
  const ocrWrapper = document.getElementById('ocr-wrapper');
  const ocrVideo = document.getElementById('ocr-video');
  const ocrCanvas = document.getElementById('ocr-canvas');
  const btnCaptureOcr = document.getElementById('btn-capture-ocr');
  const ocrLoading = document.getElementById('ocr-loading');
  const ocrStatusText = document.getElementById('ocr-status-text');

  const inputIsbn = document.getElementById('input-isbn');
  const btnSearchIsbn = document.getElementById('btn-search-isbn');

  const resultCard = document.getElementById('result-card');
  const scanSourceBadge = document.getElementById('scan-source-badge');
  const bookCover = document.getElementById('book-cover');
  const bookCoverPlaceholder = document.getElementById('book-cover-placeholder');
  const bookTitle = document.getElementById('book-title');
  const bookAuthor = document.getElementById('book-author').querySelector('span');
  const bookPublisher = document.getElementById('book-publisher').querySelector('span');
  const bookPubdate = document.getElementById('book-pubdate').querySelector('span');
  const bookIsbn = document.getElementById('book-isbn').querySelector('span');

  const previewColA = document.getElementById('preview-col-a');
  const previewColB = document.getElementById('preview-col-b');
  const previewColC = document.getElementById('preview-col-c');
  const previewColD = document.getElementById('preview-col-d');
  const previewColE = document.getElementById('preview-col-e');
  const previewColF = document.getElementById('preview-col-f');
  const previewColG = document.getElementById('preview-col-g');

  const btnSaveSheet = document.getElementById('btn-save-sheet');
  const btnResetScan = document.getElementById('btn-reset-scan');

  const btnSettings = document.getElementById('btn-settings');
  const gasStatusDot = document.getElementById('gas-status-dot');
  const modalSettings = document.getElementById('modal-settings');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const inputGasUrl = document.getElementById('input-gas-url');
  const btnSaveSettings = document.getElementById('btn-save-settings');

  const navItems = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');
  const btnRefreshList = document.getElementById('btn-refresh-list');
  const bookTableBody = document.getElementById('book-table-body');
  const listStatus = document.getElementById('list-status');

  const inputSearchBook = document.getElementById('input-search-book');
  const btnClearSearch = document.getElementById('btn-clear-search');

  // --- 初期化 ---
  updateGasStatusUI();

  // Service Worker 登録
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js?v=260812').catch(err => {
      console.log('SW registration error:', err);
    });
  }

  // --- モード切替 (バーコード vs OCR) ---
  modeBarcodeBtn.addEventListener('click', () => {
    if (activeMode === 'barcode') return;
    switchMode('barcode');
  });

  modeOcrBtn.addEventListener('click', () => {
    if (activeMode === 'ocr') return;
    switchMode('ocr');
  });

  function switchMode(mode) {
    if (isCameraScanning) {
      stopCamera();
    }
    activeMode = mode;
    
    if (mode === 'barcode') {
      modeBarcodeBtn.classList.add('active');
      modeOcrBtn.classList.remove('active');
    } else {
      modeOcrBtn.classList.add('active');
      modeBarcodeBtn.classList.remove('active');
    }
  }

  // --- カメラ起動/停止 トグル ---
  btnToggleCamera.addEventListener('click', () => {
    if (isCameraScanning) {
      stopCamera();
    } else {
      startCamera();
    }
  });

  function startCamera() {
    if (activeMode === 'barcode') {
      startBarcodeCamera();
    } else {
      startOcrCamera();
    }
  }

  function stopCamera() {
    if (activeMode === 'barcode') {
      stopBarcodeCamera();
    } else {
      stopOcrCamera();
    }
  }

  // --- 1. バーコードカメラロジック ---
  function startBarcodeCamera() {
    barcodeWrapper.classList.remove('hidden');
    ocrWrapper.classList.add('hidden');
    html5QrCode = new Html5Qrcode("reader");

    const config = { fps: 15, qrbox: { width: 250, height: 110 } };

    html5QrCode.start(
      { facingMode: "environment" },
      config,
      onBarcodeScanned,
      () => {}
    ).then(() => {
      isCameraScanning = true;
      cameraBtnText.textContent = 'カメラ停止';
      btnToggleCamera.classList.replace('btn-primary', 'btn-secondary');
    }).catch(err => {
      console.error("Barcode camera start error:", err);
      showToast("カメラの起動に失敗しました。アクセス権限を確認してください", "error");
      barcodeWrapper.classList.add('hidden');
    });
  }

  function stopBarcodeCamera() {
    if (html5QrCode && isCameraScanning) {
      html5QrCode.stop().then(() => {
        html5QrCode.clear();
        isCameraScanning = false;
        barcodeWrapper.classList.add('hidden');
        cameraBtnText.textContent = 'カメラ起動';
        btnToggleCamera.classList.replace('btn-secondary', 'btn-primary');
      }).catch(err => console.error(err));
    }
  }

  function onBarcodeScanned(decodedText) {
    const cleaned = decodedText.replace(/[^0-9]/g, '');
    if (cleaned.length === 13 && (cleaned.startsWith('978') || cleaned.startsWith('979'))) {
      playBeepSound();
      if (navigator.vibrate) navigator.vibrate(150);

      stopBarcodeCamera();
      inputIsbn.value = cleaned;
      fetchBookData(cleaned, 'Barcode');
    }
  }

  // --- 2. OCR (文字読み取り) カメラロジック ---
  async function startOcrCamera() {
    ocrWrapper.classList.remove('hidden');
    barcodeWrapper.classList.add('hidden');

    try {
      const constraints = {
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      };
      ocrVideoStream = await navigator.mediaDevices.getUserMedia(constraints);
      ocrVideo.srcObject = ocrVideoStream;

      isCameraScanning = true;
      cameraBtnText.textContent = 'カメラ停止';
      btnToggleCamera.classList.replace('btn-primary', 'btn-secondary');
    } catch (err) {
      console.error("OCR camera error:", err);
      showToast("カメラの起動に失敗しました", "error");
      ocrWrapper.classList.add('hidden');
    }
  }

  function stopOcrCamera() {
    if (ocrVideoStream) {
      ocrVideoStream.getTracks().forEach(track => track.stop());
      ocrVideoStream = null;
    }
    isCameraScanning = false;
    ocrWrapper.classList.add('hidden');
    cameraBtnText.textContent = 'カメラ起動';
    btnToggleCamera.classList.replace('btn-secondary', 'btn-primary');
  }

  // OCRキャプチャ読み取り実行
  btnCaptureOcr.addEventListener('click', async () => {
    if (!ocrVideoStream || !ocrVideo.videoWidth) {
      showToast('カメラ映像が準備できていません', 'error');
      return;
    }

    ocrLoading.classList.remove('hidden');
    ocrStatusText.textContent = 'カメラ枠内のISBN文字を解析中...';

    const canvas = ocrCanvas;
    const ctx = canvas.getContext('2d');

    // --- OCR精度向上のためのクロップ処理 ---
    // UI上のターゲット枠に合わせて、ビデオの中央付近のみを切り出す
    // object-fit: cover を考慮した簡易的な計算
    const videoW = ocrVideo.videoWidth;
    const videoH = ocrVideo.videoHeight;
    
    // ターゲット枠の比率 (幅85%, 高さ約35%相当)
    const cropWidth = videoW * 0.85;
    const cropHeight = videoH * 0.35;
    const cropX = (videoW - cropWidth) / 2;
    const cropY = (videoH - cropHeight) / 2;

    canvas.width = cropWidth;
    canvas.height = cropHeight;

    // クロップして描画
    ctx.drawImage(ocrVideo, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

    // 画像処理: グレースケールとコントラスト強調でOCR精度を上げる
    ctx.filter = 'grayscale(100%) contrast(150%)';
    ctx.drawImage(canvas, 0, 0);

    try {
      if (typeof Tesseract === 'undefined') {
        showToast('Tesseract.js OCRライブラリの読み込みに失敗しました', 'error');
        ocrLoading.classList.add('hidden');
        return;
      }

      const result = await Tesseract.recognize(canvas, 'eng+jpn', {
        logger: m => {
          if (m.status === 'recognizing text') {
            ocrStatusText.textContent = `ISBN文字解析中... ${Math.round(m.progress * 100)}%`;
          }
        }
      });

      ocrLoading.classList.add('hidden');
      const text = result.data.text;

      const extractedIsbn = extractIsbnFromText(text);

      if (extractedIsbn) {
        playBeepSound();
        if (navigator.vibrate) navigator.vibrate(150);

        stopOcrCamera();
        inputIsbn.value = extractedIsbn;
        showToast(`ISBN文字を取得しました: ${extractedIsbn}`, 'success');
        fetchBookData(extractedIsbn, 'OCR');
      } else {
        // デバッグ用: 解析された生テキストをコンソールに出力
        console.log("OCR raw text:", text);
        showToast('ISBN文字が検出されませんでした。印刷文字に近づけて再試行してください', 'error');
      }

    } catch (err) {
      console.error("OCR process error:", err);
      ocrLoading.classList.add('hidden');
      showToast('OCR処理中にエラーが発生しました', 'error');
    }
  });

  function extractIsbnFromText(text) {
    if (!text) return null;
    const rawClean = text.replace(/[^0-9X]/gi, '');
    
    const match13 = text.match(/(?:ISBN(?:-13)?:?\s*)?(97[89][-\s]?[0-9][-\s]?[0-9]{2,5}[-\s]?[0-9]{2,5}[-\s]?[0-9X])/i);
    if (match13 && match13[1]) {
      const isbnCandidate = match13[1].replace(/[^0-9]/g, '');
      if (isbnCandidate.length === 13) return isbnCandidate;
    }

    const matchRaw13 = rawClean.match(/(97[89]\d{10})/);
    if (matchRaw13 && matchRaw13[1]) {
      return matchRaw13[1];
    }

    const match10 = text.match(/(?:ISBN(?:-10)?:?\s*)?([0-9][-\s]?[0-9]{2,5}[-\s]?[0-9]{2,5}[-\s]?[0-9X])/i);
    if (match10 && match10[1]) {
      const isbn10 = match10[1].replace(/[^0-9X]/gi, '');
      if (isbn10.length === 10) return isbn10;
    }

    return null;
  }

  // --- 手動ISBN検索 ---
  btnSearchIsbn.addEventListener('click', () => {
    const rawIsbn = inputIsbn.value.trim().replace(/-/g, '');
    if (!rawIsbn) {
      showToast('ISBNコードを入力してください', 'error');
      return;
    }
    fetchBookData(rawIsbn, 'Manual');
  });

  inputIsbn.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') btnSearchIsbn.click();
  });

  // --- OpenBD API 通信 ---
  async function fetchBookData(isbn, sourceMode = 'OpenBD') {
    showToast('OpenBDより書誌情報を取得中...', 'info');

    try {
      const response = await fetch(`https://api.openbd.jp/v1/get?isbn=${isbn}`);
      const data = await response.json();

      if (data && data[0] && data[0].summary) {
        const summary = data[0].summary;
        const todayStr = getTodayFormatted();

        currentBookData = {
          isbn: summary.isbn || isbn,
          title: summary.title || 'タイトル不明',
          author: summary.author || '著者不明',
          publisher: summary.publisher || '出版社不明',
          pubdate: formatPubDate(summary.pubdate),
          cover: summary.cover || '',
          registerDate: todayStr,
          disposeDate: ''
        };

        renderBookPreview(currentBookData, sourceMode);
        showToast('書誌情報を取得しました！', 'success');
      } else {
        showToast('OpenBD未登録本です。手動入力を行ってください', 'error');
        const todayStr = getTodayFormatted();
        currentBookData = {
          isbn: isbn,
          title: prompt('タイトルを入力してください:') || '未登録タイトル',
          author: prompt('著者名を入力してください:') || '-',
          publisher: prompt('出版社名を入力してください:') || '-',
          pubdate: '-',
          cover: '',
          registerDate: todayStr,
          disposeDate: ''
        };
        renderBookPreview(currentBookData, sourceMode + ' (手動補完)');
      }
    } catch (error) {
      console.error("OpenBD fetch error:", error);
      showToast("通信エラーが発生しました", "error");
    }
  }

  function renderBookPreview(book, modeTag) {
    bookTitle.textContent = book.title;
    bookAuthor.textContent = book.author;
    bookPublisher.textContent = book.publisher;
    bookPubdate.textContent = book.pubdate;
    bookIsbn.textContent = book.isbn;
    scanSourceBadge.textContent = `OpenBD (${modeTag})`;

    if (book.cover) {
      bookCover.src = book.cover;
      bookCover.classList.remove('hidden');
      bookCoverPlaceholder.classList.add('hidden');
    } else {
      bookCover.classList.add('hidden');
      bookCoverPlaceholder.classList.remove('hidden');
    }

    previewColA.textContent = book.isbn;
    previewColB.textContent = book.title;
    previewColC.textContent = book.author;
    previewColD.textContent = book.publisher;
    previewColE.textContent = book.pubdate;
    previewColF.textContent = book.registerDate;
    previewColG.textContent = '(空欄)';

    resultCard.classList.remove('hidden');
    resultCard.scrollIntoView({ behavior: 'smooth' });
  }

  // --- Googleスプレッドシートへの保存 (GAS Web API) ---
  async function saveToSpreadsheet() {
    if (!gasUrl) {
      showToast('GAS URLが未設定です。右上設定から保存してください', 'error');
      modalSettings.classList.remove('hidden');
      return;
    }

    if (!currentBookData) {
      showToast('保存するデータがありません', 'error');
      return;
    }

    btnSaveSheet.disabled = true;
    btnSaveSheet.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 保存中...';

    try {
      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(currentBookData)
      });

      const resJson = await response.json();

      if (resJson.status === 'success') {
        showToast('スプレッドシートに保存完了！', 'success');
        resultCard.classList.add('hidden');
        inputIsbn.value = '';
        currentBookData = null;
      } else if (resJson.status === 'duplicate') {
        showToast(resJson.message, 'error');
      } else {
        showToast('エラー: ' + resJson.message, 'error');
      }
    } catch (err) {
      console.error("GAS save error:", err);
      showToast('スプレッドシートへの送信完了', 'info');
      resultCard.classList.add('hidden');
    } finally {
      btnSaveSheet.disabled = false;
      btnSaveSheet.innerHTML = '<i class="fa-file-excel fa-regular"></i> スプレッドシートに保存';
    }
  }

  btnSaveSheet.addEventListener('click', saveToSpreadsheet);

  btnResetScan.addEventListener('click', () => {
    resultCard.classList.add('hidden');
    inputIsbn.value = '';
    currentBookData = null;
    showToast('次の読み取りを行ってください', 'info');
  });

  // --- スプレッドシート蔵書一覧の取得 & 検索フィルタリング ---
  async function fetchSheetBooks() {
    if (!gasUrl) {
      listStatus.textContent = 'GAS Web App URLが未設定です。設定を行ってください。';
      return;
    }

    listStatus.textContent = 'スプレッドシートから蔵書一覧を読み込み中...';
    bookTableBody.innerHTML = '';

    try {
      const response = await fetch(gasUrl);
      const data = await response.json();

      if (data.status === 'success' && data.books) {
        allLoadedBooks = data.books.reverse();
        filterAndRenderBooks(inputSearchBook.value.trim());
      } else {
        listStatus.textContent = 'データの取得に失敗しました: ' + (data.message || '');
      }
    } catch (err) {
      console.error("Fetch list error:", err);
      listStatus.textContent = '取得エラーが発生しました。GAS URLをご確認ください。';
    }
  }

  function filterAndRenderBooks(keyword) {
    bookTableBody.innerHTML = '';
    const query = keyword.toLowerCase();

    if (query) {
      btnClearSearch.classList.remove('hidden');
    } else {
      btnClearSearch.classList.add('hidden');
    }

    const filtered = allLoadedBooks.filter(b => {
      if (!query) return true;
      return (b.title && b.title.toLowerCase().includes(query)) ||
             (b.author && b.author.toLowerCase().includes(query)) ||
             (b.publisher && b.publisher.toLowerCase().includes(query)) ||
             (b.isbn && b.isbn.toLowerCase().includes(query)) ||
             (b.pubdate && b.pubdate.toLowerCase().includes(query)) ||
             (b.registerDate && b.registerDate.toLowerCase().includes(query));
    });

    if (query) {
      listStatus.textContent = `全 ${allLoadedBooks.length} 冊中 ${filtered.length} 冊がヒットしました ("${keyword}")`;
    } else {
      listStatus.textContent = `全 ${allLoadedBooks.length} 冊が登録されています。`;
    }

    if (filtered.length === 0) {
      bookTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px; color:#94a3b8;">${query ? '該当する書籍は見つかりませんでした' : 'まだ本が登録されていません'}</td></tr>`;
      return;
    }

    filtered.forEach(b => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><code>${escapeHtml(b.isbn)}</code></td>
        <td><strong>${escapeHtml(b.title)}</strong></td>
        <td>${escapeHtml(b.author)}</td>
        <td>${escapeHtml(b.publisher)}</td>
        <td>${escapeHtml(b.pubdate)}</td>
        <td><span class="badge badge-success">${escapeHtml(b.registerDate)}</span></td>
        <td>${b.disposeDate ? escapeHtml(b.disposeDate) : '<span style="color:#64748b;">未処分</span>'}</td>
      `;
      bookTableBody.appendChild(tr);
    });
  }

  inputSearchBook.addEventListener('input', (e) => {
    filterAndRenderBooks(e.target.value.trim());
  });

  btnClearSearch.addEventListener('click', () => {
    inputSearchBook.value = '';
    filterAndRenderBooks('');
  });

  // --- 設定モーダル ---
  btnSettings.addEventListener('click', () => {
    inputGasUrl.value = gasUrl;
    modalSettings.classList.remove('hidden');
  });

  btnCloseModal.addEventListener('click', () => {
    modalSettings.classList.add('hidden');
  });

  btnSaveSettings.addEventListener('click', () => {
    gasUrl = inputGasUrl.value.trim();
    localStorage.setItem('bookscan_gas_url', gasUrl);
    updateGasStatusUI();
    modalSettings.classList.add('hidden');
    showToast('GAS URL設定を保存しました', 'success');
  });

  btnRefreshList.addEventListener('click', fetchSheetBooks);

  // タブ切り替え
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetTab = item.getAttribute('data-tab');
      navItems.forEach(n => n.classList.remove('active'));
      tabContents.forEach(t => t.classList.remove('active'));

      item.classList.add('active');
      document.getElementById(targetTab).classList.add('active');

      if (targetTab === 'tab-list') {
        if (isCameraScanning) stopCamera();
        fetchSheetBooks();
      }
    });
  });

  // --- ユーティリティ ---
  function updateGasStatusUI() {
    if (gasUrl) {
      gasStatusDot.classList.replace('disconnected', 'connected');
      gasStatusDot.title = 'GAS設定済み';
    } else {
      gasStatusDot.classList.replace('connected', 'disconnected');
      gasStatusDot.title = 'GAS未設定';
    }
  }

  function getTodayFormatted() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}/${m}/${day}`;
  }

  function formatPubDate(rawDate) {
    if (!rawDate) return '-';
    if (rawDate.length === 8) return `${rawDate.slice(0,4)}/${rawDate.slice(4,6)}/${rawDate.slice(6,8)}`;
    if (rawDate.length === 6) return `${rawDate.slice(0,4)}/${rawDate.slice(4,6)}`;
    return rawDate;
  }

  function playBeepSound() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {}
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-triangle-exclamation';

    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
});

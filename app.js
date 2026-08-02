/**
 * BookScan 蔵書管理 Web/PWA JavaScript
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- 状態変数 ---
  let html5QrCode = null;
  let isCameraScanning = false;
  let currentBookData = null;
  let gasUrl = localStorage.getItem('bookscan_gas_url') || '';

  // --- DOM要素 ---
  const btnToggleCamera = document.getElementById('btn-toggle-camera');
  const cameraBtnText = document.getElementById('camera-btn-text');
  const readerWrapper = document.getElementById('reader-wrapper');
  const inputIsbn = document.getElementById('input-isbn');
  const btnSearchIsbn = document.getElementById('btn-search-isbn');
  
  const resultCard = document.getElementById('result-card');
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

  // 一覧タブ・設定モーダル要素
  const btnSettings = document.getElementById('btn-settings');
  const gasStatusDot = document.getElementById('gas-status-dot');
  const modalSettings = document.getElementById('modal-settings');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const inputGasUrl = document.getElementById('input-gas-url');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const linkShowGuide = document.getElementById('link-show-guide');
  const gasGuideContent = document.getElementById('gas-guide-content');

  const navItems = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');
  const btnRefreshList = document.getElementById('btn-refresh-list');
  const bookTableBody = document.getElementById('book-table-body');
  const listStatus = document.getElementById('list-status');

  // --- 初期設定 ---
  updateGasStatusUI();

  // Service Worker 登録 (PWA用)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.log('ServiceWorker registration failed: ', err);
    });
  }

  // --- イベントリスナー ---

  // タブ切り替え
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetTab = item.getAttribute('data-tab');
      
      navItems.forEach(n => n.classList.remove('active'));
      tabContents.forEach(t => t.classList.remove('active'));

      item.classList.add('active');
      document.getElementById(targetTab).classList.add('active');

      if (targetTab === 'tab-list') {
        // カメラ停止
        if (isCameraScanning) stopCamera();
        fetchSheetBooks();
      }
    });
  });

  // カメラトグルボタン
  btnToggleCamera.addEventListener('click', () => {
    if (isCameraScanning) {
      stopCamera();
    } else {
      startCamera();
    }
  });

  // 手動ISBN検索
  btnSearchIsbn.addEventListener('click', () => {
    const rawIsbn = inputIsbn.value.trim().replace(/-/g, '');
    if (!rawIsbn) {
      showToast('ISBNコードを入力してください', 'error');
      return;
    }
    fetchBookData(rawIsbn);
  });

  inputIsbn.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      btnSearchIsbn.click();
    }
  });

  // スプレッドシート保存ボタン
  btnSaveSheet.addEventListener('click', () => {
    saveToSpreadsheet();
  });

  // リセットボタン
  btnResetScan.addEventListener('click', () => {
    resultCard.classList.add('hidden');
    inputIsbn.value = '';
    currentBookData = null;
    showToast('次のバーコードをスキャンしてください', 'info');
  });

  // 設定モーダル
  btnSettings.addEventListener('click', () => {
    inputGasUrl.value = gasUrl;
    modalSettings.classList.remove('hidden');
  });

  btnCloseModal.addEventListener('click', () => {
    modalSettings.classList.add('hidden');
  });

  linkShowGuide.addEventListener('click', (e) => {
    e.preventDefault();
    gasGuideContent.classList.toggle('hidden');
  });

  btnSaveSettings.addEventListener('click', () => {
    gasUrl = inputGasUrl.value.trim();
    localStorage.setItem('bookscan_gas_url', gasUrl);
    updateGasStatusUI();
    modalSettings.classList.add('hidden');
    showToast('GAS URL設定を保存しました', 'success');
  });

  btnRefreshList.addEventListener('click', () => {
    fetchSheetBooks();
  });

  // --- カメラ＆バーコード読み取りロジック ---

  function startCamera() {
    readerWrapper.classList.remove('hidden');
    html5QrCode = new Html5Qrcode("reader");

    const config = {
      fps: 15,
      qrbox: { width: 250, height: 120 },
      aspectRatio: 1.0
    };

    html5QrCode.start(
      { facingMode: "environment" }, // リアカメラ優先
      config,
      onBarcodeScanned,
      onScanError
    ).then(() => {
      isCameraScanning = true;
      cameraBtnText.textContent = 'カメラ停止';
      btnToggleCamera.classList.replace('btn-primary', 'btn-secondary');
    }).catch(err => {
      console.error("Camera start error:", err);
      showToast("カメラの起動に失敗しました。アクセス権限を確認してください", "error");
      readerWrapper.classList.add('hidden');
    });
  }

  function stopCamera() {
    if (html5QrCode && isCameraScanning) {
      html5QrCode.stop().then(() => {
        html5QrCode.clear();
        isCameraScanning = false;
        readerWrapper.classList.add('hidden');
        cameraBtnText.textContent = 'カメラ起動';
        btnToggleCamera.classList.replace('btn-secondary', 'btn-primary');
      }).catch(err => {
        console.error("Camera stop error:", err);
      });
    }
  }

  function onBarcodeScanned(decodedText) {
    // ISBN-13 は 978 または 979 で始まる13桁
    const cleaned = decodedText.replace(/[^0-9]/g, '');
    if (cleaned.length === 13 && (cleaned.startsWith('978') || cleaned.startsWith('979'))) {
      playBeepSound();
      if (navigator.vibrate) navigator.vibrate(150);

      stopCamera();
      inputIsbn.value = cleaned;
      fetchBookData(cleaned);
    }
  }

  function onScanError(errorMessage) {
    // 継続的にスキャン試行中のフレームエラーは無視
  }

  // --- OpenBD API 通信 ---

  async function fetchBookData(isbn) {
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
          disposeDate: '' // G列用(空欄)
        };

        renderBookPreview(currentBookData);
        showToast('書誌情報を取得しました！', 'success');
      } else {
        // OpenBDで見つからなかった場合の手動補完プロンプト
        showToast('OpenBDに未登録の書籍です。手動入力を行ってください', 'error');
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
        renderBookPreview(currentBookData);
      }
    } catch (error) {
      console.error("OpenBD fetch error:", error);
      showToast("通信エラーが発生しました", "error");
    }
  }

  function renderBookPreview(book) {
    bookTitle.textContent = book.title;
    bookAuthor.textContent = book.author;
    bookPublisher.textContent = book.publisher;
    bookPubdate.textContent = book.pubdate;
    bookIsbn.textContent = book.isbn;

    if (book.cover) {
      bookCover.src = book.cover;
      bookCover.classList.remove('hidden');
      bookCoverPlaceholder.classList.add('hidden');
    } else {
      bookCover.classList.add('hidden');
      bookCoverPlaceholder.classList.remove('hidden');
    }

    // A~G列プレビュー描画
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
      showToast('GASのWeb App URLが設定されていません。右上ギア設定から登録してください', 'error');
      modalSettings.classList.remove('hidden');
      return;
    }

    if (!currentBookData) {
      showToast('保存する書籍データがありません', 'error');
      return;
    }

    btnSaveSheet.disabled = true;
    btnSaveSheet.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 保存中...';

    try {
      // GASのWeb AppへPOST送信 (no-corsではなくCORS対応のJSONポスト)
      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8' // GAS doPost互換
        },
        body: JSON.stringify(currentBookData)
      });

      const resJson = await response.json();

      if (resJson.status === 'success') {
        showToast('スプレッドシートに保存しました！', 'success');
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
      // no-cors 等でリダイレクトされる場合のフォールバック送信
      showToast('スプレッドシート送信完了 (応答未確認)', 'info');
      resultCard.classList.add('hidden');
    } finally {
      btnSaveSheet.disabled = false;
      btnSaveSheet.innerHTML = '<i class="fa-file-excel fa-regular"></i> スプレッドシートに保存';
    }
  }

  // --- スプレッドシート蔵書一覧の取得 ---

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
        listStatus.textContent = `全 ${data.count} 冊が登録されています。`;
        
        if (data.books.length === 0) {
          bookTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">まだ本が登録されていません。</td></tr>';
          return;
        }

        data.books.reverse().forEach(b => {
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
      } else {
        listStatus.textContent = 'データの取得に失敗しました: ' + (data.message || '');
      }
    } catch (err) {
      console.error("Fetch list error:", err);
      listStatus.textContent = '取得エラーが発生しました。GAS URLをご確認ください。';
    }
  }

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
    // 20190921 や 201909 などを YYYY/MM/DD や YYYY/MM に整形
    if (rawDate.length === 8) {
      return `${rawDate.slice(0,4)}/${rawDate.slice(4,6)}/${rawDate.slice(6,8)}`;
    }
    if (rawDate.length === 6) {
      return `${rawDate.slice(0,4)}/${rawDate.slice(4,6)}`;
    }
    return rawDate;
  }

  function playBeepSound() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
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
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});

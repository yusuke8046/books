/**
 * 蔵書管理 Google Apps Script バックエンド (_260812 バージョン)
 * 
 * 列構成:
 * A列: ISBN
 * B列: タイトル
 * C列: 著者名
 * D列: 出版社名
 * E列: 発行日
 * F列: 登録日
 * G列: 処分日 (手動入力枠・初期状態は空欄)
 */

function setupSheet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var headers = ["ISBN", "タイトル", "著者名", "出版社名", "発行日", "登録日", "処分日"];
  
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    var range = sheet.getRange(1, 1, 1, headers.length);
    range.setBackground("#1e293b");
    range.setFontColor("#ffffff");
    range.setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
}

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    if (sheet.getLastRow() === 0) {
      setupSheet();
    }

    var contents = e.postData.contents;
    var data = JSON.parse(contents);

    var isbn = data.isbn || "";
    var title = data.title || "";
    var author = data.author || "";
    var publisher = data.publisher || "";
    var pubdate = data.pubdate || "";
    var registerDate = data.registerDate || formatDate(new Date());

    if (!isbn) {
      return createJsonResponse({ status: "error", message: "ISBNコードが必要です" });
    }

    // A列重複チェック
    var lastRow = sheet.getLastRow();
    var isDuplicate = false;
    if (lastRow > 1) {
      var isbns = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < isbns.length; i++) {
        if (String(isbns[i][0]).trim() === String(isbn).trim()) {
          isDuplicate = true;
          break;
        }
      }
    }

    if (isDuplicate) {
      return createJsonResponse({
        status: "duplicate",
        message: "この書籍 (ISBN: " + isbn + ") は既にスプレッドシートに登録されています",
        data: { isbn: isbn, title: title }
      });
    }

    // A~G列追記 (G列: 処分日は空欄)
    sheet.appendRow([isbn, title, author, publisher, pubdate, registerDate, ""]);

    return createJsonResponse({
      status: "success",
      message: "スプレッドシートへの登録が完了しました",
      data: {
        isbn: isbn,
        title: title,
        author: author,
        publisher: publisher,
        pubdate: pubdate,
        registerDate: registerDate,
        disposeDate: ""
      }
    });

  } catch (error) {
    return createJsonResponse({
      status: "error",
      message: error.toString()
    });
  }
}

function doGet(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var lastRow = sheet.getLastRow();
    var result = [];

    if (lastRow > 1) {
      var data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
      for (var i = 0; i < data.length; i++) {
        result.push({
          isbn: String(data[i][0]),
          title: String(data[i][1]),
          author: String(data[i][2]),
          publisher: String(data[i][3]),
          pubdate: String(data[i][4]),
          registerDate: String(data[i][5]),
          disposeDate: String(data[i][6])
        });
      }
    }

    return createJsonResponse({
      status: "success",
      count: result.length,
      books: result
    });

  } catch (error) {
    return createJsonResponse({
      status: "error",
      message: error.toString()
    });
  }
}

function createJsonResponse(obj) {
  var output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

function formatDate(date) {
  var y = date.getFullYear();
  var m = ('0' + (date.getMonth() + 1)).slice(-2);
  var d = ('0' + date.getDate()).slice(-2);
  return y + '/' + m + '/' + d;
}

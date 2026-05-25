// ================================================================
// Autotec Andamento Revistoria — Apps Script para Google Sheets
//
// COMO IMPLANTAR:
//   1. Abra a planilha no Google Sheets
//   2. Menu: Extensões > Apps Script
//   3. Apague o código existente e cole este arquivo inteiro
//   4. Salve (Ctrl+S)
//   5. Clique em "Implantar" > "Nova implantação"
//      - Tipo: Aplicativo da Web
//      - Executar como: Eu mesmo
//      - Quem pode acessar: Qualquer pessoa
//   6. Autorize o acesso quando solicitado
//   7. Copie a URL gerada e cole no campo "URL do Apps Script" da extensão
//
// CONFIGURAÇÃO DAS COLUNAS:
//   Ajuste as constantes abaixo para corresponder aos cabeçalhos
//   exatos da sua planilha (linha 1 da aba).
// ================================================================

const GID_DESTINO = 926788909;

const COL_PLACA    = 'Placa';
const COL_PROCESSO = 'Processo';
const COL_VERSAO   = 'Versão';
const COL_CANAL    = 'Canal';
const COL_DATA     = 'Data Revistoria';
const COL_HORA     = 'Hora';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheets().find(s => s.getSheetId() === GID_DESTINO)
                  || ss.getActiveSheet();
    const lastCol = Math.max(sheet.getLastColumn(), 1);
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

    function colIdx(name) {
      return headers.findIndex(h =>
        String(h).trim().toLowerCase() === name.trim().toLowerCase()
      );
    }

    const placaIdx = colIdx(COL_PLACA);
    if (placaIdx === -1)
      return jsonResp({ ok: false, error: `Cabeçalho "${COL_PLACA}" não encontrado na linha 1.` });

    const lastRow   = sheet.getLastRow();
    const allValues = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, lastCol).getValues() : [];

    let targetRow = -1;
    const placaNorm = norm(data.placa);
    for (let i = 0; i < allValues.length; i++) {
      if (norm(String(allValues[i][placaIdx])) === placaNorm) {
        targetRow = i + 2;
        break;
      }
    }

    if (targetRow === -1) {
      const row = new Array(headers.length).fill('');
      const set = (col, val) => { const i = colIdx(col); if (i !== -1) row[i] = val; };
      set(COL_PLACA,    data.placa    || '');
      set(COL_PROCESSO, data.processo || '');
      set(COL_VERSAO,   data.versao   || '');
      set(COL_CANAL,    data.canal    || '');
      set(COL_DATA,     data.data     || '');
      set(COL_HORA,     data.hora     || '');
      sheet.appendRow(row);
      return jsonResp({ ok: true, action: 'appended' });
    } else {
      const write = (col, val) => { const i = colIdx(col); if (i !== -1) sheet.getRange(targetRow, i + 1).setValue(val); };
      write(COL_PROCESSO, data.processo || '');
      write(COL_VERSAO,   data.versao   || '');
      write(COL_CANAL,    data.canal    || '');
      write(COL_DATA,     data.data     || '');
      write(COL_HORA,     data.hora     || '');
      return jsonResp({ ok: true, action: 'updated', row: targetRow });
    }
  } catch (err) {
    return jsonResp({ ok: false, error: err.message });
  }
}

function norm(s) { return String(s).replace(/[-\s]/g,'').toUpperCase().trim(); }
function jsonResp(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

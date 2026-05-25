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
//
// CONVIVÊNCIA COM OUTROS SCRIPTS:
//   Este script usa LockService para garantir escrita exclusiva
//   e só toca nas colunas mapeadas abaixo — não interfere com
//   colunas preenchidas por outros scripts.
// ================================================================

const GID_DESTINO = 926788909; // ID da aba (número após gid= na URL)

// Nomes dos cabeçalhos — ajuste conforme sua planilha
const COL_PLACA    = 'Placa';
const COL_PROCESSO = 'Processo';
const COL_VERSAO   = 'Versão';
const COL_CANAL    = 'Canal';
// ⚠ Data e Hora são preenchidos pelo outro script — não mexa aqui

// ----------------------------------------------------------------

function doPost(e) {
  // Lock de planilha: aguarda até 10 s antes de falhar
  const lock = LockService.getSpreadsheetLock();
  try {
    lock.waitLock(10000);
  } catch (err) {
    return jsonResp({ ok: false, error: 'Planilha ocupada por outro script, tente novamente.' });
  }

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
    const allValues = lastRow > 1
      ? sheet.getRange(2, 1, lastRow - 1, lastCol).getValues()
      : [];

    let targetRow = -1;
    const placaNorm = norm(data.placa);
    for (let i = 0; i < allValues.length; i++) {
      if (norm(String(allValues[i][placaIdx])) === placaNorm) {
        targetRow = i + 2; // base-1 + cabeçalho
        break;
      }
    }

    // Escreve APENAS nas colunas mapeadas — não toca nas demais
    const write = (col, val) => {
      const i = colIdx(col);
      if (i !== -1) sheet.getRange(targetRow, i + 1).setValue(val);
    };

    if (targetRow === -1) {
      // Placa não encontrada → nova linha (só nas colunas mapeadas)
      const row = new Array(headers.length).fill('');
      const set = (col, val) => { const i = colIdx(col); if (i !== -1) row[i] = val; };
      set(COL_PLACA,    data.placa    || '');
      set(COL_PROCESSO, data.processo || '');
      set(COL_VERSAO,   data.versao   || '');
      set(COL_CANAL,    data.canal    || '');
      sheet.appendRow(row);
      return jsonResp({ ok: true, action: 'appended' });
    } else {
      // Placa encontrada → atualiza só Processo, Versão e Canal
      write(COL_PROCESSO, data.processo || '');
      write(COL_VERSAO,   data.versao   || '');
      write(COL_CANAL,    data.canal    || '');
      return jsonResp({ ok: true, action: 'updated', row: targetRow });
    }

  } catch (err) {
    return jsonResp({ ok: false, error: err.message });
  } finally {
    lock.releaseLock();
  }
}

function norm(s) { return String(s).replace(/[-\s]/g, '').toUpperCase().trim(); }

function jsonResp(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

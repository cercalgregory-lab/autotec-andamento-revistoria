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
// ESTRUTURA DE COLUNAS (mesma do processarXML):
//   H (8)  → PLACA          — usado para localizar a linha
//   I (9)  → CANAL REG.     — preenchido pela extensão
//   K (11) → VERSÃO         — preenchido pela extensão
//   O (15) → STATUS         — preenchido pela extensão (REGULAR / IRREGULAR)
//
// CONVIVÊNCIA COM processarXML:
//   Usa LockService para escrita exclusiva e só toca nas colunas
//   I, K e O — todas as demais colunas ficam intactas.
// ================================================================

const SPREADSHEET_ID = '1mgh99vNCrC8TjIaOFLDTkxK_kaNOQI41xkafvD3_csg';
const GID_DESTINO    = 926788909; // aba "Junho" (gid= na URL)

// Posições de coluna (1-based) — mesma lógica do processarXML
const COL_PLACA  = 8;   // H - PLACA  (busca)
const COL_CANAL  = 9;   // I - CANAL REG.
const COL_VERSAO = 11;  // K - VERSÃO
const COL_STATUS = 15;  // O - STATUS

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

    // openById garante acesso mesmo em Web App externo
    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheets().find(s => s.getSheetId() === GID_DESTINO)
                  || ss.getSheetByName('Junho');

    if (!sheet) {
      return jsonResp({ ok: false, error: 'Aba de destino não encontrada na planilha.' });
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return jsonResp({ ok: false, error: 'Planilha sem dados.' });
    }

    // Busca a placa na coluna H (8) — ignora hífens, espaços e case
    const placas = sheet
      .getRange(2, COL_PLACA, lastRow - 1, 1)
      .getValues()
      .map(r => norm(r[0]));

    const placaNorm = norm(data.placa);
    const idx       = placas.indexOf(placaNorm);

    if (idx === -1) {
      return jsonResp({
        ok: false,
        error: `Placa "${data.placa}" não encontrada na planilha. Verifique se o XML já foi processado.`
      });
    }

    const targetRow = idx + 2; // +1 base-1, +1 cabeçalho

    // Escreve APENAS nas colunas mapeadas — não toca nas demais
    sheet.getRange(targetRow, COL_CANAL ).setValue(data.canal  || '');
    sheet.getRange(targetRow, COL_VERSAO).setValue(data.versao || '');
    sheet.getRange(targetRow, COL_STATUS).setValue(data.status || '');

    return jsonResp({ ok: true, action: 'updated', row: targetRow });

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

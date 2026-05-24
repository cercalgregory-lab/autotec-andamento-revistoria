# Autotec Andamento Revistoria — Extensão Chrome

Painel lateral para gerar e injetar andamentos padronizados de revistoria no WebSoma.

## Instalação (modo desenvolvedor)

1. Descompactar o ZIP em uma pasta local.
2. Abrir `chrome://extensions/`.
3. Ativar **Modo do desenvolvedor** (canto superior direito).
4. Clicar em **Carregar sem compactação** e selecionar a pasta `extension/`.

## Uso

1. Abrir a aba **Anotações** de uma revistoria no WebSoma.
2. Clicar no ícone da extensão na barra do Chrome → o painel lateral aparece.
3. Preencher os campos. A data/hora é preenchida automaticamente.
4. A oficina é detectada do cabeçalho da página (código + nome).
5. Telefone e e-mail são carregados do cadastro local quando a oficina já foi salva.
6. **Copiar**: envia o texto para a área de transferência.
7. **Colar no SOMA**: injeta diretamente no `<textarea>` da aba Anotações.

Ambos os botões salvam telefone/e-mail no cadastro da oficina atual.

## Recursos

- Painel arrastável (segurar barra azul) e redimensionável (canto inferior direito).
- Posição/tamanho persistem entre sessões.
- Cadastro local de oficinas (chave = código SOMA).
- Pré-visualização do texto final em tempo real (seção colapsável).
- Campos de detalhe aparecem só quando relevantes (ex: "fora dos padrões" → abre justificativa).
- Shadow DOM isola o CSS — não conflita com o WebSoma.

## Estrutura

```
extension/
  manifest.json      Manifest V3
  background.js      Service worker (toggle do painel)
  content.js         Painel + lógica de geração e injeção
  panel.css          Estilo do host (Shadow DOM interno tem CSS próprio)
```

## Notas

- Cadastro de oficinas fica em `chrome.storage.local` (apenas neste navegador, neste perfil).
- Para exportar/limpar o cadastro: abrir DevTools → Console na página com o painel aberto e usar `chrome.storage.local.get(console.log)` ou `chrome.storage.local.clear()`.

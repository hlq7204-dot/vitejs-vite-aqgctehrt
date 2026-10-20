import type { Card, CardType, Deck, Folder, ActivityMap } from '../types';
import { FOLDER_THEMES, DECK_THEMES } from '../constants/themes';
import { getEffectiveLapses } from './fsrs';
import { loadScript, getTodayStr } from './helpers';

declare global {
  interface Window {
    initSqlJs?: any;
    JSZip?: any;
    fzstd?: any;
  }
}

export const buildExportJSONFile = (data: {
  dailyGoal: number;
  desiredRetention: number;
  folders: Folder[];
  decks: Deck[];
  activityMap: ActivityMap;
  streakRecoveries: string[];
}) => {
  const backupData = {
    version: 2,
    exportedAt: new Date().toISOString(),
    ...data,
  };
  const blob = new Blob([JSON.stringify(backupData, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `flashcards-backup-${getTodayStr()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const buildExportCSVFile = (validDecks: Deck[]) => {
  const stripHtml = (html?: string) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html || '';
    return (tmp.textContent || tmp.innerText || '')
      .replace(/"/g, '""')
      .replace(/\r?\n/g, ' ');
  };

  const rows: (string | number)[][] = [
    [
      'Baralho',
      'Tipo',
      'Tags',
      'Frente',
      'Verso / Detalhes',
      'Gabarito',
      'Estado FSRS',
      'Dificuldade',
      'Estabilidade',
      'Intervalo (dias)',
      'Revisoes',
      'Erros (Lapses)',
      'Suspenso',
    ],
  ];

  validDecks.forEach((d) => {
    (d.cards || []).forEach((c) => {
      const stateMap: Record<number, string> = {
        0: 'Novo',
        1: 'Aprender',
        2: 'Revisao',
        3: 'Reaprender',
      };
      const st =
        c.state !== undefined
          ? stateMap[c.state]
          : c.reviews > 0
          ? 'Revisao'
          : 'Novo';

      let answerInfo = '';
      if (c.type === 'choice') answerInfo = (c.options || [])[c.correctOption || 0] || '';
      else if (c.type === 'tf') answerInfo = c.isTrue ? 'Verdadeiro' : 'Falso';
      else if (c.type === 'typing') answerInfo = c.typeAnswer || '';

      const tagsFormatted = (c.tags || []).map((t) => `#${t}`).join(' ');

      rows.push([
        `"${(d.name || '').replace(/"/g, '""')}"`,
        `"${c.type || 'standard'}"`,
        `"${tagsFormatted.replace(/"/g, '""')}"`,
        `"${stripHtml(c.front)}"`,
        `"${stripHtml(c.back)}"`,
        `"${String(answerInfo).replace(/"/g, '""')}"`,
        `"${st}"`,
        c.difficulty !== undefined ? Number(c.difficulty).toFixed(2) : '',
        c.stability !== undefined ? Number(c.stability).toFixed(2) : '',
        c.interval !== undefined ? Number(c.interval).toFixed(2) : '0',
        c.reviews || 0,
        getEffectiveLapses(c),
        c.isSuspended ? 'Sim' : 'Nao',
      ]);
    });
  });

  const csvContent = '\uFEFF' + rows.map((r) => r.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `flashcards-export-${getTodayStr()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const parseAnkiPackage = async (
  file: File,
  currentFolderId: string | null,
  existingFolders: Folder[],
  onProgress?: (msg: string) => void
): Promise<{ newFolders: Folder[]; newDecks: Deck[]; importedCount: number }> => {
  let sqliteDb: any = null;
  try {
    if (onProgress) onProgress('A carregar...');
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js');
    await loadScript('https://cdn.jsdelivr.net/npm/fzstd/umd/index.js');

    const initSqlJsFn = window.initSqlJs;
    const JSZipClass = window.JSZip;
    if (!initSqlJsFn || !JSZipClass) throw new Error('Bibliotecas falharam.');

    const SQL = await initSqlJsFn({
      locateFile: (f: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${f}`,
    });
    await new Promise((r) => setTimeout(r, 100));
    const zip = new JSZipClass();
    await zip.loadAsync(file);

    const dbFile =
      zip.file('collection.anki21b') ||
      zip.file('collection.anki21') ||
      zip.file('collection.anki2');
    if (!dbFile) throw new Error('Base de dados Anki não encontrada.');

    let dbData = await dbFile.async('uint8array');
    if (dbFile.name === 'collection.anki21b') {
      if (!window.fzstd) throw new Error('Biblioteca de descompressão falhou.');
      dbData = window.fzstd.decompress(dbData);
    }
    sqliteDb = new SQL.Database(dbData);

    let mediaMap: Record<string, string> = {};
    if (zip.file('media')) {
      try {
        const mediaData = await zip.file('media').async('string');
        mediaMap = JSON.parse(mediaData);
      } catch (err) {}
    }

    const mediaAssets: Record<string, string> = {};
    const fileNames = Object.keys(zip.files);
    for (let i = 0; i < fileNames.length; i++) {
      const mappedName = mediaMap[fileNames[i]];
      if (
        mappedName &&
        typeof mappedName === 'string' &&
        mappedName.match(/\.(jpeg|jpg|gif|png|svg|webp)$/i)
      ) {
        try {
          const b64 = await zip.file(fileNames[i]).async('base64');
          const exts = mappedName.split('.').pop()?.toLowerCase() || 'png';
          mediaAssets[mappedName] = `data:image/${
            exts === 'jpg' ? 'jpeg' : exts
          };base64,${b64}`;
        } catch (err) {}
      }
    }

    const decksInfo: { id: string; name: string }[] = [];
    try {
      const decksTable = sqliteDb.exec('SELECT id, name FROM decks');
      if (decksTable.length > 0 && decksTable[0].values) {
        decksTable[0].values.forEach((row: any[]) =>
          decksInfo.push({ id: String(row[0]), name: String(row[1]) })
        );
      }
    } catch (e) {
      try {
        const colQuery = sqliteDb.exec('SELECT decks FROM col');
        if (colQuery.length > 0 && colQuery[0].values && colQuery[0].values[0]) {
          const parsed = JSON.parse(colQuery[0].values[0][0]);
          Object.values(parsed).forEach((d: any) =>
            decksInfo.push({ id: String(d.id), name: String(d.name) })
          );
        }
      } catch (err) {}
    }

    const importBatchId = Date.now();
    const newDecksMap: Record<string, Deck> = {};
    const newFolders: Folder[] = [];

    const getOrCreateFolder = (fName: string, parentId: string | null): string => {
      const existing =
        newFolders.find((x) => x.name === fName && x.parentId === parentId) ||
        existingFolders.find((x) => x.name === fName && x.parentId === parentId);
      if (existing) return existing.id;

      const newId = `f-anki-${importBatchId}-${Math.random().toString(36).substring(2, 9)}`;
      const newFolder: Folder = {
        id: newId,
        name: fName,
        parentId,
        color: FOLDER_THEMES[0].color,
      };
      newFolders.push(newFolder);
      return newId;
    };

    decksInfo.forEach((ankiDeck) => {
      if (ankiDeck.name === 'Default' && ankiDeck.id === '1') return;
      const pathParts = ankiDeck.name
        .split(/::|\x1f|\x1e/)
        .map((p) => p.trim())
        .filter(Boolean);
      if (pathParts.length === 0) return;
      let parent = currentFolderId;
      const deckName = pathParts.pop()!;
      pathParts.forEach((p) => {
        parent = getOrCreateFolder(p, parent);
      });
      newDecksMap[ankiDeck.id] = {
        id: `d-anki-${importBatchId}-${ankiDeck.id}`,
        name: deckName,
        parentId: parent,
        color: DECK_THEMES[0].color,
        cards: [],
      };
    });

    const fallbackDeck: Deck = {
      id: `d-fb-${importBatchId}`,
      name: file.name.split('.')[0],
      parentId: currentFolderId,
      color: DECK_THEMES[0].color,
      cards: [],
    };

    const cardsQuery = sqliteDb.exec(
      'SELECT c.did, n.flds FROM cards c JOIN notes n ON c.nid = n.id'
    );

    let importedCount = 0;
    if (cardsQuery.length > 0) {
      cardsQuery[0].values.forEach((row: any[]) => {
        const fields = String(row[1]).split('\x1f');
        if (fields.length >= 2 && !fields[0].includes('Atualize para a versão')) {
          let front = fields[0];
          let back = fields[1];
          Object.keys(mediaAssets).forEach((imgName) => {
            const b64 = mediaAssets[imgName];
            front = front
              .split(imgName)
              .join(b64)
              .split(encodeURIComponent(imgName))
              .join(b64);
            back = back
              .split(imgName)
              .join(b64)
              .split(encodeURIComponent(imgName))
              .join(b64);
          });
          const newCard: Card = {
            id: `c-anki-${importBatchId}-${Math.random().toString(36).substring(2, 9)}`,
            type: 'standard',
            front,
            back,
            state: 0,
            interval: 0,
            dueDate: Date.now(),
            reviews: 0,
          };
          if (newDecksMap[String(row[0])]) {
            newDecksMap[String(row[0])].cards.push(newCard);
          } else {
            fallbackDeck.cards.push(newCard);
          }
          importedCount++;
        }
      });
    }

    const newDecks = Object.values(newDecksMap).filter((d) => d.cards.length > 0);
    if (fallbackDeck.cards.length > 0) newDecks.push(fallbackDeck);

    return { newFolders, newDecks, importedCount };
  } finally {
    if (sqliteDb) {
      try {
        sqliteDb.close();
      } catch (closeErr) {}
    }
  }
};

export const parseTextImportContent = (
  text: string,
  fileName: string,
  currentFolderId: string | null
): Deck | null => {
  if (text.includes('\x00')) {
    throw new Error('Ficheiro binário não suportado.');
  }

  const lines = text.split('\n');
  const importedCards: Card[] = [];

  lines.forEach((line) => {
    if (!line.trim()) return;

    let parsedType: CardType = 'standard';
    let parsedFront = '';
    let parsedBack = '';
    let parsedOptions = ['', '', '', ''];
    let parsedCorrectOption = 0;

    const gabaritoIndex = line.search(/Gabarito:/i);

    if (gabaritoIndex !== -1 && /[a-e]\)/i.test(line.substring(0, gabaritoIndex))) {
      parsedType = 'choice';
      const rawFront = line.substring(0, gabaritoIndex).replace(/[\t\s]+$/, '');
      const rawBack = line.substring(gabaritoIndex);

      const firstOptionMatch = rawFront.match(/(?:<br\s*\/?>\s*)*a\)/i);
      if (firstOptionMatch && firstOptionMatch.index !== undefined) {
        const questionEndIndex = firstOptionMatch.index;
        parsedFront = rawFront
          .substring(0, questionEndIndex)
          .replace(/<br\s*[\/]?>/gi, '<br>')
          .trim();

        const optionsPart = rawFront.substring(questionEndIndex);
        const optionsRegex = /[a-e]\)\s*([\s\S]*?)(?=(?:<br\s*\/?>\s*)*[a-e]\)|$)/gi;
        let match;
        const extractedOptions: string[] = [];
        while ((match = optionsRegex.exec(optionsPart)) !== null) {
          extractedOptions.push(match[1].replace(/<br\s*\/?>/gi, '').trim());
        }
        if (extractedOptions.length >= 2) {
          parsedOptions = extractedOptions;
        }
      } else {
        parsedFront = rawFront.replace(/<br\s*[\/]?>/gi, '<br>').trim();
      }

      const gabaritoMatch = rawBack.match(/Gabarito:\s*([a-e])\)/i);
      if (gabaritoMatch) {
        const letter = gabaritoMatch[1].toLowerCase();
        parsedCorrectOption = letter.charCodeAt(0) - 97;
      }

      const justMatch = rawBack.match(/Justificativa:\s*([\s\S]*)/i);
      if (justMatch) {
        parsedBack = `<strong>Justificativa:</strong><br>${justMatch[1]
          .replace(/<br\s*[\/]?>/gi, '<br>')
          .trim()}`;
      } else {
        parsedBack = rawBack.replace(/<br\s*[\/]?>/gi, '<br>').trim();
      }
    } else {
      const separator = line.includes('\t') ? '\t' : ',';
      const parts = line.split(separator);
      const rawFront = parts[0] || '';
      const rawBack = parts.slice(1).join(separator) || '';

      parsedFront = rawFront.replace(/<br\s*[\/]?>/gi, '<br>').trim();
      parsedBack = rawBack.replace(/<br\s*[\/]?>/gi, '<br>').trim();
    }

    importedCards.push({
      id: `c-imp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      type: parsedType,
      front: parsedFront,
      back: parsedBack,
      options: parsedOptions,
      correctOption: parsedCorrectOption,
      state: 0,
      interval: 0,
      dueDate: Date.now(),
      reviews: 0,
    });
  });

  if (importedCards.length === 0) return null;

  return {
    id: `d-imp-${Date.now()}`,
    name: fileName.split('.')[0],
    parentId: currentFolderId,
    description: 'Importado',
    color: DECK_THEMES[0].color,
    cards: importedCards,
  };
};
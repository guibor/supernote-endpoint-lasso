import {
  NativeUIUtils,
  PluginCommAPI,
  PluginDocAPI,
  PluginFileAPI,
} from 'sn-plugin-lib';
import {ENDPOINT_CONFIG, isNotePath} from '../config';

const DEFAULT_TIMEOUT_MS = 20000;
const MAX_CONTOURS = 50;
const MAX_POINTS_PER_CONTOUR = 500;
const DOC_SELECTION_RETRY = {
  attempts: 12,
  initialDelayMs: 250,
  delayMs: 200,
};

let isRunning = false;

export async function sendCurrentLassoSelection(logger = console) {
  return sendCurrentSelection('lasso', logger);
}

export async function sendCurrentDocSelection(logger = console) {
  return sendCurrentSelection('doc_selection', logger);
}

async function sendCurrentSelection(mode, logger = console) {
  if (isRunning) {
    await NativeUIUtils.showRattaDialog(
      'A request is already in progress.',
      'OK',
      '',
      true,
    );
    return null;
  }

  isRunning = true;
  try {
    const payload =
      mode === 'doc_selection'
        ? await buildDocSelectionPayload()
        : await buildLassoPayload();
    const pngPath = await maybeGeneratePagePng(
      payload.source.file_path,
      payload.source.page_num,
      logger,
    );
    const response = await dispatchToEndpoint(payload, pngPath, logger);

    const responseText = response.text ? `\nResponse: ${response.text}` : '';
    await NativeUIUtils.showRattaDialog(
      `${ENDPOINT_CONFIG.successDialogTitle}\nStatus: ${response.status}${responseText}`,
      'OK',
      '',
      true,
    );

    return {payload, pngPath, response};
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await NativeUIUtils.showRattaDialog(
      `Endpoint request failed:\n${message}`,
      'OK',
      '',
      false,
    );
    throw error;
  } finally {
    isRunning = false;
  }
}

async function buildDocSelectionPayload() {
  const [filePathRes, pageRes] = await Promise.all([
    PluginCommAPI.getCurrentFilePath(),
    PluginCommAPI.getCurrentPageNum(),
  ]);

  if (!filePathRes?.success || !filePathRes.result) {
    throw new Error(
      filePathRes?.error?.message ?? 'Failed to read current file path.',
    );
  }

  if (!pageRes?.success || typeof pageRes.result !== 'number') {
    throw new Error(
      pageRes?.error?.message ?? 'Failed to read current page number.',
    );
  }

  const selectedText = await getSelectedTextWithRetry();
  const filePath = filePathRes.result;
  const pageNum = pageRes.result;

  return {
    framework: {
      name: 'Endpoint Lasso',
      version: ENDPOINT_CONFIG.pluginVersion,
    },
    generated_at: new Date().toISOString(),
    source: {
      file_path: filePath,
      file_kind: isNotePath(filePath) ? 'note' : 'document',
      page_num: pageNum,
      page_size: null,
      selection_kind: 'doc_text',
      selection_api: 'PluginDocAPI.getLastSelectedText',
    },
    selection: {
      kind: 'doc_text',
      text: selectedText,
    },
    selected_text: selectedText,
    elements: [],
    attachments: {
      page_png_included: false,
      page_png_mode: 'not-supported-for-doc-selection',
    },
  };
}

async function buildLassoPayload() {
  const [filePathRes, pageRes, rectRes, elementsRes] = await Promise.all([
    PluginCommAPI.getCurrentFilePath(),
    PluginCommAPI.getCurrentPageNum(),
    PluginCommAPI.getLassoRect(),
    PluginCommAPI.getLassoElements(),
  ]);

  if (!filePathRes?.success || !filePathRes.result) {
    throw new Error(
      filePathRes?.error?.message ?? 'Failed to read current file path.',
    );
  }

  if (!pageRes?.success || typeof pageRes.result !== 'number') {
    throw new Error(
      pageRes?.error?.message ?? 'Failed to read current page number.',
    );
  }

  if (!rectRes?.success || !rectRes.result) {
    throw new Error(
      rectRes?.error?.message ?? 'Failed to read current lasso rectangle.',
    );
  }

  if (!elementsRes?.success || !Array.isArray(elementsRes.result)) {
    throw new Error(
      elementsRes?.error?.message ?? 'Failed to read current lasso elements.',
    );
  }

  const filePath = filePathRes.result;
  const pageNum = pageRes.result;
  const pageSizeRes = await PluginFileAPI.getPageSize(filePath, pageNum);
  const pageSize = pageSizeRes?.success ? pageSizeRes.result : null;
  const elements = await Promise.all(
    elementsRes.result.map(serializeLassoElement),
  );

  return {
    framework: {
      name: 'Endpoint Lasso',
      version: ENDPOINT_CONFIG.pluginVersion,
    },
    generated_at: new Date().toISOString(),
    source: {
      file_path: filePath,
      file_kind: isNotePath(filePath) ? 'note' : 'document',
      page_num: pageNum,
      page_size: pageSize,
      lasso_rect: rectRes.result,
    },
    elements,
    attachments: {
      page_png_included: false,
      page_png_mode: isNotePath(filePath)
        ? 'note-export'
        : 'not-supported-for-doc',
    },
  };
}

async function serializeLassoElement(element) {
  const textBox = element.textBox;
  const text =
    textBox?.textContentFull ??
    element.title?.titleContent ??
    element.link?.linkContent ??
    null;

  const contours = element.contoursSrc
    ? await readContours(element.contoursSrc)
    : null;

  return {
    type: element.type,
    uuid: element.uuid ?? null,
    page_num: element.pageNum ?? null,
    layer_num: element.layerNum ?? null,
    recognize_result: element.recognizeResult ?? null,
    text,
    text_rect: textBox?.textRect ?? null,
    contours,
  };
}

async function getSelectedTextWithRetry() {
  if (DOC_SELECTION_RETRY.initialDelayMs > 0) {
    await sleep(DOC_SELECTION_RETRY.initialDelayMs);
  }

  let lastError = '';
  for (let attempt = 1; attempt <= DOC_SELECTION_RETRY.attempts; attempt += 1) {
    try {
      const response = await readLastSelectedText();
      if (response?.success === true) {
        const text = extractSelectedText(response.result);
        if (text) {
          return text;
        }
        lastError = `selection API returned empty text on attempt ${attempt}`;
      } else {
        lastError =
          response?.error?.message ??
          `selection API failed on attempt ${attempt}`;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await sleep(DOC_SELECTION_RETRY.delayMs);
  }

  throw new Error(
    `No highlighted DOC text was returned. Re-highlight text and tap the DOC selection button. ${lastError}`,
  );
}

async function readLastSelectedText() {
  const read = PluginDocAPI.getLastSelectedText ?? PluginDocAPI.getSelectedText;
  if (typeof read !== 'function') {
    throw new Error('PluginDocAPI selected-text API is unavailable.');
  }

  return read.call(PluginDocAPI);
}

function extractSelectedText(result) {
  if (typeof result !== 'string') {
    return '';
  }

  return result
    .replace(/\r\n/g, '\n')
    .split('')
    .map(char => (isControlChar(char) ? ' ' : char))
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isControlChar(char) {
  const code = char.charCodeAt(0);
  return (
    (code >= 0 && code <= 8) ||
    code === 11 ||
    code === 12 ||
    (code >= 14 && code <= 31) ||
    code === 127
  );
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function readContours(accessor) {
  const size = await accessor.size();
  if (!size || size <= 0) {
    return [];
  }

  const count = Math.min(size, MAX_CONTOURS);
  const contours = await accessor.getRange(0, count);
  return contours.map(points =>
    downsamplePoints(points, MAX_POINTS_PER_CONTOUR),
  );
}

function downsamplePoints(points, maxPoints) {
  if (!Array.isArray(points) || points.length <= maxPoints) {
    return points ?? [];
  }

  const stride = Math.ceil(points.length / maxPoints);
  const sampled = [];
  for (let index = 0; index < points.length; index += stride) {
    sampled.push(points[index]);
  }
  return sampled;
}

async function maybeGeneratePagePng(filePath, pageNum, logger) {
  if (!ENDPOINT_CONFIG.includePagePng) {
    return null;
  }

  if (!isNotePath(filePath)) {
    logger.log(
      '[endpoint-lasso] Skipping PNG export for non-NOTE file:',
      filePath,
    );
    return null;
  }

  const fileName = `endpoint_lasso_page_${pageNum}_${Date.now()}.png`;
  const pngPath = `${ENDPOINT_CONFIG.exportDir}/${fileName}`;

  const response = await PluginFileAPI.generateNotePng({
    notePath: filePath,
    page: pageNum,
    times: ENDPOINT_CONFIG.pngScale,
    pngPath,
    type: ENDPOINT_CONFIG.pngBackgroundType,
  });

  if (!response?.success || response.result === false) {
    throw new Error(response?.error?.message ?? 'Failed to generate page PNG.');
  }

  logger.log('[endpoint-lasso] Generated page PNG:', pngPath);
  return pngPath;
}

async function dispatchToEndpoint(payload, pngPath, logger) {
  const controller = new AbortController();
  const timeoutMs = ENDPOINT_CONFIG.timeoutMs || DEFAULT_TIMEOUT_MS;
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response;

    if (ENDPOINT_CONFIG.requestFormat === 'json') {
      const body = JSON.stringify({
        payload,
        page_png_included: false,
      });

      response = await fetch(ENDPOINT_CONFIG.endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...ENDPOINT_CONFIG.headers,
        },
        body,
        signal: controller.signal,
      });
    } else {
      const formData = new FormData();
      const payloadWithAttachments = {
        ...payload,
        attachments: {
          ...payload.attachments,
          page_png_included: Boolean(pngPath),
        },
      };

      formData.append(
        ENDPOINT_CONFIG.payloadFieldName,
        JSON.stringify(payloadWithAttachments),
      );

      if (pngPath) {
        const uri = pngPath.startsWith('file://')
          ? pngPath
          : `file://${pngPath}`;
        formData.append(ENDPOINT_CONFIG.imageFieldName, {
          uri,
          name: pngPath.split('/').pop() || 'page.png',
          type: 'image/png',
        });
      }

      response = await fetch(ENDPOINT_CONFIG.endpointUrl, {
        method: 'POST',
        headers: {
          ...ENDPOINT_CONFIG.headers,
        },
        body: formData,
        signal: controller.signal,
      });
    }

    const text = await safeReadText(response);
    if (!response.ok) {
      throw new Error(
        `Endpoint returned ${response.status}: ${text || response.statusText}`,
      );
    }

    logger.log('[endpoint-lasso] Endpoint response:', response.status, text);
    return {
      status: response.status,
      text: truncateForDialog(text),
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function safeReadText(response) {
  try {
    return await response.text();
  } catch (_error) {
    return '';
  }
}

function truncateForDialog(value) {
  if (!value) {
    return '';
  }

  const text = String(value).trim();
  if (text.length <= 220) {
    return text;
  }

  return `${text.slice(0, 217)}...`;
}

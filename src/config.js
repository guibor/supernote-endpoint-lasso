import {ENDPOINT_CONFIG as GENERATED_CONFIG} from './runtimeConfig';

export const BUTTON_ID = 9101;
export const BUTTON_DOC_SELECTION_ID = 9102;
export const BUTTON_NAME = String(GENERATED_CONFIG.buttonName || 'Send Lasso');
export const BUTTON_DOC_SELECTION_NAME = String(
  GENERATED_CONFIG.docSelectionButtonName ||
    GENERATED_CONFIG.buttonName ||
    'Send Selection',
);
export const SUPPORTED_DATA_TYPES = [0, 1, 2, 3, 4, 5];

export const ENDPOINT_CONFIG = Object.freeze({
  endpointUrl: String(GENERATED_CONFIG.endpointUrl || '').trim(),
  requestFormat:
    GENERATED_CONFIG.requestFormat === 'json' ? 'json' : 'multipart',
  timeoutMs: Number(GENERATED_CONFIG.timeoutMs || 20000),
  includePagePng: Boolean(GENERATED_CONFIG.includePagePng),
  exportDir: String(GENERATED_CONFIG.exportDir || '/storage/emulated/0/Export'),
  pngScale: Number(GENERATED_CONFIG.pngScale || 1),
  pngBackgroundType: Number(GENERATED_CONFIG.pngBackgroundType ?? 1),
  payloadFieldName: String(GENERATED_CONFIG.payloadFieldName || 'payload'),
  imageFieldName: String(GENERATED_CONFIG.imageFieldName || 'page_png'),
  headers: Object.freeze({...GENERATED_CONFIG.headers}),
  successDialogTitle: String(
    GENERATED_CONFIG.successDialogTitle || 'Endpoint response',
  ),
  pluginVersion: String(GENERATED_CONFIG.pluginVersion || '0.1.3'),
});

export function isNotePath(filePath) {
  return (
    typeof filePath === 'string' && filePath.toLowerCase().endsWith('.note')
  );
}

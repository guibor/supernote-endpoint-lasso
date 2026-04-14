#!/usr/bin/env node

import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(projectRoot, '.env');
const outputPath = path.join(projectRoot, 'src', 'runtimeConfig.js');

function parseDotEnv(text) {
  const result = {};

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex < 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

function loadEnv() {
  const fileEnv = fs.existsSync(envPath) ? parseDotEnv(fs.readFileSync(envPath, 'utf8')) : {};
  return {...fileEnv, ...process.env};
}

function readRequired(env, key) {
  const value = String(env[key] || '').trim();
  if (!value) {
    throw new Error(`${key} is required. Set it in .env or the shell environment.`);
  }
  return value;
}

function readString(env, key, fallback) {
  const value = env[key];
  return value == null || String(value).trim() === '' ? fallback : String(value).trim();
}

function readInt(env, key, fallback) {
  const raw = env[key];
  if (raw == null || String(raw).trim() === '') {
    return fallback;
  }

  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`${key} must be a number.`);
  }

  return Math.trunc(value);
}

function readBool(env, key, fallback) {
  const raw = env[key];
  if (raw == null || String(raw).trim() === '') {
    return fallback;
  }

  const normalized = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  throw new Error(`${key} must be a boolean value.`);
}

function readHeaders(env) {
  const headers = {};
  const authName = readString(env, 'SN_AUTH_HEADER_NAME', '');
  const authValue = readString(env, 'SN_AUTH_HEADER_VALUE', '');

  if ((authName && !authValue) || (!authName && authValue)) {
    throw new Error('SN_AUTH_HEADER_NAME and SN_AUTH_HEADER_VALUE must be set together.');
  }

  if (authName && authValue) {
    headers[authName] = authValue;
  }

  const extraHeadersRaw = readString(env, 'SN_EXTRA_HEADERS_JSON', '');
  if (extraHeadersRaw) {
    const parsed = JSON.parse(extraHeadersRaw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('SN_EXTRA_HEADERS_JSON must be a JSON object.');
    }

    for (const [key, value] of Object.entries(parsed)) {
      headers[String(key)] = String(value);
    }
  }

  return headers;
}

function buildConfig(env) {
  return {
    endpointUrl: readRequired(env, 'SN_ENDPOINT_URL'),
    requestFormat: readString(env, 'SN_REQUEST_FORMAT', 'multipart') === 'json' ? 'json' : 'multipart',
    timeoutMs: readInt(env, 'SN_TIMEOUT_MS', 20000),
    includePagePng: readBool(env, 'SN_INCLUDE_PAGE_PNG', true),
    exportDir: readString(env, 'SN_EXPORT_DIR', '/storage/emulated/0/Export'),
    pngScale: readInt(env, 'SN_PNG_SCALE', 1),
    pngBackgroundType: readInt(env, 'SN_PNG_BACKGROUND_TYPE', 1),
    buttonName: readString(env, 'SN_BUTTON_NAME', 'Send Lasso'),
    payloadFieldName: readString(env, 'SN_PAYLOAD_FIELD_NAME', 'payload'),
    imageFieldName: readString(env, 'SN_IMAGE_FIELD_NAME', 'page_png'),
    successDialogTitle: readString(env, 'SN_SUCCESS_DIALOG_TITLE', 'Endpoint response'),
    pluginVersion: '0.1.1',
    headers: readHeaders(env),
  };
}

function writeConfigFile(config) {
  const source = `export const ENDPOINT_CONFIG = Object.freeze(${JSON.stringify(
    config,
    null,
    2,
  )});\n`;

  fs.mkdirSync(path.dirname(outputPath), {recursive: true});
  fs.writeFileSync(outputPath, source, 'utf8');
}

try {
  const env = loadEnv();
  const config = buildConfig(env);
  writeConfigFile(config);
  console.log(`Generated ${path.relative(projectRoot, outputPath)}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

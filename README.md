# Endpoint Lasso

Endpoint Lasso is a public Supernote plugin framework for sending the current lasso selection, or highlighted DOC text, to your own HTTP endpoint.

It is intentionally generic. Instead of baking in one personal backend, it gives you a reusable transport layer that you can point at your own service for OCR, indexing, search, note capture, flashcard generation, or custom LLM pipelines.

## What It Does

- works from the lasso toolbar in `NOTE` and `DOC`
- also adds a DOC text-selection toolbar button for highlighted text
- sends structured metadata for the current file, page, lasso rectangle, and selected elements
- can optionally attach a generated full-page `NOTE` PNG
- supports either `multipart` or `json` request formats
- is configured from environment variables before build, so no source edits are required for normal setup

## Quick Start

1. Copy `.env.example` to `.env`.
2. Set `SN_ENDPOINT_URL`.
3. Optionally set auth headers, timeout, button label, PNG behavior, and request format.
4. Install dependencies:

```sh
npm install
```

5. Build the plugin:

```sh
npm run build:plugin
```

The packaged plugin is written to:

```text
build/outputs/supernote-endpoint-lasso.snplg
```

## Configuration

The build step reads `.env` plus the current shell environment and generates `src/runtimeConfig.js`.

Required:

- `SN_ENDPOINT_URL`: destination endpoint URL

Common optional variables:

- `SN_REQUEST_FORMAT`: `multipart` or `json` (default: `multipart`)
- `SN_AUTH_HEADER_NAME`: auth header name, for example `Authorization`
- `SN_AUTH_HEADER_VALUE`: auth header value, for example `Bearer ...`
- `SN_EXTRA_HEADERS_JSON`: JSON object of extra headers
- `SN_BUTTON_NAME`: toolbar label (default: `Send Lasso`)
- `SN_DOC_SELECTION_BUTTON_NAME`: DOC text-selection label (default: `Send Selection`)
- `SN_TIMEOUT_MS`: request timeout in milliseconds (default: `20000`)
- `SN_INCLUDE_PAGE_PNG`: `true` or `false` (default: `true`)
- `SN_EXPORT_DIR`: device path for temporary PNG export
- `SN_PNG_SCALE`: PNG scale factor (default: `1`)
- `SN_PNG_BACKGROUND_TYPE`: `0` transparent or `1` white (default: `1`)
- `SN_PAYLOAD_FIELD_NAME`: multipart field name for the JSON payload (default: `payload`)
- `SN_IMAGE_FIELD_NAME`: multipart field name for the page PNG (default: `page_png`)
- `SN_SUCCESS_DIALOG_TITLE`: success dialog title shown on-device

## Payload Shape

For lasso selections, Endpoint Lasso builds a payload shaped like this:

```json
{
  "framework": {
    "name": "Endpoint Lasso",
    "version": "0.1.2"
  },
  "generated_at": "2026-04-14T00:00:00.000Z",
  "source": {
    "file_path": "...",
    "file_kind": "note",
    "page_num": 3,
    "page_size": {"width": 1404, "height": 1872},
    "lasso_rect": {"left": 100, "top": 200, "right": 600, "bottom": 900}
  },
  "elements": [
    {
      "type": 0,
      "uuid": "...",
      "page_num": 3,
      "layer_num": 1,
      "recognize_result": null,
      "text": null,
      "text_rect": null,
      "contours": [[{"x": 1, "y": 2}]]
    }
  ],
  "attachments": {
    "page_png_included": true,
    "page_png_mode": "note-export"
  }
}
```

If `SN_REQUEST_FORMAT=multipart`, the payload is sent as a JSON field plus an optional PNG file field.

If `SN_REQUEST_FORMAT=json`, the payload is sent as JSON only.

For highlighted DOC text, the payload uses the same transport but sets
`source.selection_kind` to `doc_text` and includes both a structured selection
object and a convenience top-level `selected_text` field:

```json
{
  "framework": {
    "name": "Endpoint Lasso",
    "version": "0.1.2"
  },
  "generated_at": "2026-04-22T00:00:00.000Z",
  "source": {
    "file_path": "...",
    "file_kind": "document",
    "page_num": 3,
    "page_size": null,
    "selection_kind": "doc_text",
    "selection_api": "PluginDocAPI.getLastSelectedText"
  },
  "selection": {
    "kind": "doc_text",
    "text": "highlighted text from the document"
  },
  "selected_text": "highlighted text from the document",
  "elements": [],
  "attachments": {
    "page_png_included": false,
    "page_png_mode": "not-supported-for-doc-selection"
  }
}
```

## Notes

- `NOTE` and `DOC` lasso metadata are both supported.
- DOC highlighted text is read with `PluginDocAPI.getLastSelectedText`, falling
  back to `getSelectedText` on older SDKs.
- Full-page PNG export is only attempted for `NOTE` files.
- The toolbar action is headless (`showType=0`) and uses native dialogs for success/failure feedback.
- `.env` and generated runtime config are intentionally ignored by git.

## Intended Uses

- OCR pipelines
- document or note clipping
- search and indexing
- personal knowledge system ingestion
- Anki or flashcard generation
- self-hosted or remote LLM workflows

## License

MIT

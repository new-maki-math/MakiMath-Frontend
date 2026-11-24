import { resolveAiBaseUrl } from './ai-credentials.js';

const PREFIX = 'maki_ai_models:';
const SELECTION_PREFIX = 'maki_ai_selected_model:';

function storageKey(provider, baseUrl) {
  return PREFIX + JSON.stringify([provider, resolveAiBaseUrl(provider, baseUrl)]);
}

export function loadSavedAiModels(provider, baseUrl) {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey(provider, baseUrl)) || 'null');
    if (!Array.isArray(data?.models) || !Array.isArray(data?.selectedIds)) {
      return null;
    }
    const models = data.models.filter(
      (item) =>
        typeof item?.id === 'string' &&
        /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,255}$/.test(item.id) &&
        typeof item.name === 'string' &&
        item.name.length <= 128
    );
    const ids = new Set(models.map((item) => item.id));
    return {
      models,
      selectedIds: data.selectedIds.filter((id) => ids.has(id))
    };
  } catch {
    return null;
  }
}

export function saveAiModels(provider, baseUrl, models, selectedIds) {
  localStorage.setItem(
    storageKey(provider, baseUrl),
    JSON.stringify({
      models,
      selectedIds
    })
  );
}

export function loadSelectedAiModel(provider, baseUrl) {
  try {
    return localStorage.getItem(SELECTION_PREFIX + storageKey(provider, baseUrl)) || '';
  } catch {
    return '';
  }
}

export function saveSelectedAiModel(provider, baseUrl, model) {
  localStorage.setItem(SELECTION_PREFIX + storageKey(provider, baseUrl), model);
}

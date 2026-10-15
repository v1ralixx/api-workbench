"use strict";

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const DEFAULT_REQUEST = {
  method: "GET",
  url: "https://jsonplaceholder.typicode.com/posts/1",
  headers: [{ key: "Accept", value: "application/json" }],
  params: [],
  body: "",
  authType: "none",
  authToken: "",
};

const method = document.querySelector("#http-method");
const urlInput = document.querySelector("#request-url");
const paramsList = document.querySelector("#params-list");
const headersList = document.querySelector("#headers-list");
const bodyInput = document.querySelector("#request-body");
const authType = document.querySelector("#auth-type");
const authToken = document.querySelector("#auth-token");
const tokenRow = document.querySelector("#token-row");
const sendButton = document.querySelector("#send-button");
const sendLabel = document.querySelector("#send-label");
const responseMeta = document.querySelector("#response-meta");
const responseBody = document.querySelector("#response-body");
const responseHeaders = document.querySelector("#response-headers");
const responseTime = document.querySelector("#response-time");
const copyResponseButton = document.querySelector("#copy-response");
const controllers = new Set();
let lastResponseText = "";
let activeResponseView = "body";

function createKeyValueRow(list, key = "", value = "") {
  const row = document.createElement("div");
  row.className = "key-value-row";
  const keyInput = document.createElement("input");
  keyInput.type = "text";
  keyInput.spellcheck = false;
  keyInput.autocomplete = "off";
  keyInput.placeholder = list === headersList ? "Content-Type" : "page";
  keyInput.setAttribute("aria-label", list === headersList ? "Имя заголовка" : "Имя параметра");
  keyInput.value = key;
  const valueInput = document.createElement("input");
  valueInput.type = "text";
  valueInput.spellcheck = false;
  valueInput.autocomplete = "off";
  valueInput.placeholder = list === headersList ? "application/json" : "1";
  valueInput.setAttribute("aria-label", list === headersList ? "Значение заголовка" : "Значение параметра");
  valueInput.value = value;
  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "remove-row";
  removeButton.textContent = "×";
  removeButton.setAttribute("aria-label", "Удалить строку");
  removeButton.addEventListener("click", () => {
    row.remove();
    updateCounts();
  });
  keyInput.addEventListener("input", updateCounts);
  valueInput.addEventListener("input", updateCounts);
  row.append(keyInput, valueInput, removeButton);
  list.append(row);
  updateCounts();
  return row;
}

function addRows(list, rows) {
  list.replaceChildren();
  rows.forEach(({ key, value }) => createKeyValueRow(list, key, value));
}

function readRows(list) {
  return Array.from(list.querySelectorAll(".key-value-row"), (row) => {
    const fields = row.querySelectorAll("input");
    return { key: fields[0].value.trim(), value: fields[1].value };
  }).filter((item) => item.key);
}

function updateCounts() {
  document.querySelector("#params-count").textContent = String(readRows(paramsList).length);
  document.querySelector("#headers-count").textContent = String(readRows(headersList).length);
}

function showError(message) {
  responseMeta.replaceChildren();
  const badge = document.createElement("span");
  badge.className = "status-badge network-error";
  badge.textContent = "ОШИБКА";
  const description = document.createElement("span");
  description.className = "meta-detail";
  description.textContent = message;
  responseMeta.append(badge, description);
  responseBody.textContent = message;
  lastResponseText = message;
  copyResponseButton.disabled = false;
  responseTime.textContent = "";
  showResponseView("body");
}

function showResponseView(view) {
  activeResponseView = view;
  document.querySelectorAll(".response-tab").forEach((tab) => {
    const active = tab.dataset.response === view;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  responseBody.hidden = view !== "body";
  responseHeaders.hidden = view !== "headers";
}

function updateBodyAvailability() {
  const canHaveBody = !["GET", "HEAD"].includes(method.value);
  document.querySelector("#tab-body").disabled = !canHaveBody;
  document.querySelector("#tab-body").classList.toggle("disabled-tab", !canHaveBody);
  if (!canHaveBody && document.querySelector("#panel-body").hidden === false) {
    activateRequestPanel("params");
  }
}

function activateRequestPanel(panelName) {
  document.querySelectorAll(".request-tab").forEach((tab) => {
    const active = tab.dataset.panel === panelName;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.hidden = panel.id !== `panel-${panelName}`;
  });
}

function getRequestUrl() {
  const rawUrl = urlInput.value.trim();
  if (!rawUrl) throw new Error("Укажи URL запроса.");
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Проверь URL: нужен полный адрес, например https://api.example.com/items.");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Поддерживаются только HTTP- и HTTPS-адреса.");
  }
  for (const { key, value } of readRows(paramsList)) {
    url.searchParams.append(key, value);
  }
  return url;
}

function getRequestHeaders() {
  const headers = new Headers();
  for (const { key, value } of readRows(headersList)) {
    try {
      headers.append(key, value);
    } catch {
      throw new Error(`Некорректный HTTP-заголовок: ${key}`);
    }
  }
  if (authType.value === "bearer" && authToken.value.trim()) {
    headers.set("Authorization", `Bearer ${authToken.value.trim()}`);
  }
  return headers;
}

function makeMetaBadge(text, className) {
  const badge = document.createElement("span");
  badge.className = `status-badge ${className}`;
  badge.textContent = text;
  return badge;
}

async function readResponse(response) {
  if (!response.body) return { text: "", truncated: false };
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  let truncated = false;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const remaining = MAX_RESPONSE_BYTES - total;
      if (value.byteLength > remaining) {
        chunks.push(value.subarray(0, Math.max(remaining, 0)));
        total += Math.max(remaining, 0);
        truncated = true;
        await reader.cancel();
        break;
      }
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { text: new TextDecoder().decode(combined), truncated };
}

function formatResponseBody(text, contentType, truncated) {
  if (!text) return truncated ? "[Ответ слишком большой и был обрезан.]" : "(пустое тело ответа)";
  let formatted = text;
  if (contentType.includes("json")) {
    try {
      formatted = JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      formatted = text;
    }
  }
  if (truncated) formatted += "\n\n[Ответ обрезан: показаны первые 2 МБ.]";
  return formatted;
}

function formatHeaders(headers) {
  return Array.from(headers.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `${name}: ${value}`)
    .join("\n") || "(сервер не вернул доступных заголовков)";
}

async function sendRequest() {
  if (controllers.size) {
    controllers.forEach((controller) => controller.abort());
    return;
  }

  let url;
  let headers;
  let body;
  try {
    url = getRequestUrl();
    headers = getRequestHeaders();
    body = bodyInput.value.trim();
    if (!["GET", "HEAD"].includes(method.value) && body) {
      try {
        JSON.parse(body);
      } catch {
        throw new Error("Тело запроса не является корректным JSON. Исправь JSON или очисти поле тела.");
      }
      if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    }
  } catch (error) {
    showError(error.message);
    return;
  }

  const controller = new AbortController();
  controllers.add(controller);
  sendButton.disabled = false;
  sendButton.classList.add("cancel-mode");
  sendLabel.textContent = "Отменить";
  responseMeta.replaceChildren(makeMetaBadge("ОТПРАВКА", "pending"));
  responseBody.textContent = "Жду ответ сервера…";
  responseHeaders.textContent = "";
  responseTime.textContent = "";
  lastResponseText = "";
  copyResponseButton.disabled = true;
  showResponseView("body");
  const startedAt = performance.now();

  try {
    const response = await fetch(url, {
      method: method.value,
      headers,
      body: ["GET", "HEAD"].includes(method.value) ? undefined : body || undefined,
      signal: controller.signal,
      redirect: "follow",
    });
    const { text, truncated } = await readResponse(response);
    const elapsed = Math.round(performance.now() - startedAt);
    const contentType = response.headers.get("content-type") || "";
    const displayBody = formatResponseBody(text, contentType, truncated);

    responseMeta.replaceChildren(
      makeMetaBadge(`${response.status} ${response.statusText || ""}`.trim(), response.ok ? "success" : response.status < 500 ? "client-error" : "server-error"),
      makeMetaBadge(method.value, "method-meta"),
      document.createTextNode(url.origin + url.pathname),
    );
    responseBody.textContent = displayBody;
    responseHeaders.textContent = formatHeaders(response.headers);
    responseTime.textContent = `${elapsed} ms`;
    lastResponseText = displayBody;
    copyResponseButton.disabled = false;
    showResponseView(activeResponseView);
  } catch (error) {
    if (error.name === "AbortError") {
      showError("Запрос отменён.");
    } else {
      showError("Не удалось получить ответ. Проверь адрес, соединение и CORS-настройки API.");
    }
  } finally {
    controllers.delete(controller);
    if (!controllers.size) {
      sendButton.classList.remove("cancel-mode");
      sendLabel.textContent = "Отправить";
    }
  }
}

function setExample(type) {
  const examples = {
    get: {
      method: "GET",
      url: "https://jsonplaceholder.typicode.com/posts/1",
      headers: [{ key: "Accept", value: "application/json" }],
      params: [],
      body: "",
    },
    post: {
      method: "POST",
      url: "https://jsonplaceholder.typicode.com/posts",
      headers: [{ key: "Accept", value: "application/json" }],
      params: [],
      body: JSON.stringify({ title: "Мой тестовый запрос", body: "Привет из API Workbench!", userId: 1 }, null, 2),
    },
  };
  const example = examples[type];
  if (!example) return;
  method.value = example.method;
  urlInput.value = example.url;
  bodyInput.value = example.body;
  addRows(headersList, example.headers);
  addRows(paramsList, example.params);
  updateBodyAvailability();
  activateRequestPanel("params");
}

function resetRequest() {
  method.value = DEFAULT_REQUEST.method;
  urlInput.value = DEFAULT_REQUEST.url;
  bodyInput.value = DEFAULT_REQUEST.body;
  authType.value = DEFAULT_REQUEST.authType;
  authToken.value = DEFAULT_REQUEST.authToken;
  tokenRow.hidden = true;
  addRows(headersList, DEFAULT_REQUEST.headers);
  addRows(paramsList, DEFAULT_REQUEST.params);
  updateBodyAvailability();
  activateRequestPanel("params");
  responseMeta.replaceChildren();
  const placeholder = document.createElement("span");
  placeholder.className = "status-placeholder";
  const dot = document.createElement("span");
  dot.className = "status-dot";
  placeholder.append(dot, document.createTextNode("Ожидание запроса"));
  responseMeta.append(placeholder);
  responseBody.innerHTML = '<span class="empty-response">Отправь запрос, и ответ появится здесь.</span>';
  responseHeaders.textContent = "";
  responseTime.textContent = "";
  lastResponseText = "";
  copyResponseButton.disabled = true;
  showResponseView("body");
}

document.querySelectorAll(".request-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    if (!tab.disabled) activateRequestPanel(tab.dataset.panel);
  });
});

document.querySelectorAll(".response-tab").forEach((tab) => {
  tab.addEventListener("click", () => showResponseView(tab.dataset.response));
});

document.querySelectorAll("[data-add-row]").forEach((button) => {
  button.addEventListener("click", () => {
    const list = button.dataset.addRow === "params" ? paramsList : headersList;
    createKeyValueRow(list);
    list.lastElementChild?.querySelector("input")?.focus();
  });
});

document.querySelectorAll("[data-example]").forEach((button) => {
  button.addEventListener("click", () => setExample(button.dataset.example));
});

method.addEventListener("change", updateBodyAvailability);
authType.addEventListener("change", () => {
  tokenRow.hidden = authType.value !== "bearer";
});
sendButton.addEventListener("click", sendRequest);
document.querySelector("#reset-button").addEventListener("click", resetRequest);
document.querySelector("#copy-response").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(lastResponseText);
    copyResponseButton.textContent = "Скопировано";
    window.setTimeout(() => { copyResponseButton.textContent = "Скопировать"; }, 1200);
  } catch {
    copyResponseButton.textContent = "Не удалось";
    window.setTimeout(() => { copyResponseButton.textContent = "Скопировать"; }, 1500);
  }
});
document.querySelector("#format-body").addEventListener("click", () => {
  try {
    bodyInput.value = JSON.stringify(JSON.parse(bodyInput.value), null, 2);
  } catch {
    bodyInput.focus();
    bodyInput.setAttribute("aria-invalid", "true");
    window.setTimeout(() => bodyInput.removeAttribute("aria-invalid"), 1500);
  }
});

addRows(headersList, DEFAULT_REQUEST.headers);
updateBodyAvailability();

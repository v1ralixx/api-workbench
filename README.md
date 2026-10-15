# API Workbench

Браузерный REST API-тестер для разработчиков. Собирай HTTP-запрос, добавляй query-параметры, заголовки и Bearer token, а затем смотри статус, длительность, заголовки и тело ответа.

## Возможности

- HTTP-методы GET, POST, PUT, PATCH, DELETE и HEAD.
- Query-параметры, произвольные HTTP-заголовки и JSON-тело.
- Bearer token: поле токена не сохраняется в браузере приложением.
- Форматирование JSON-ответа, время запроса, статус и заголовки ответа.
- Ограничение отображаемого тела ответа — 2 МБ.
- Отмена запроса и готовые примеры на JSONPlaceholder.
- Всё выполняется непосредственно браузером — сервер и установка не нужны.

## Запуск

Открой `index.html` в браузере.

Или из PowerShell запусти локальный сервер:

```powershell
py -m http.server 8000
```

Затем открой `http://localhost:8000`.

## Важно про CORS

Браузер разрешает JavaScript читать ответы только от серверов, которые настроили CORS. API нужно разрешить доступ с origin страницы, где запущено приложение. Если тестируется локальный API, проверь его CORS-настройки и адрес/порт. Workbench не проксирует запросы и не обходит CORS.

## GitHub Description

> Browser-based REST API client with HTTP methods, query params, headers, Bearer auth, JSON body, response viewer and request timing.

## Лицензия

MIT — см. [LICENSE](LICENSE).

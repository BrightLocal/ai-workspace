# Third-Party API Error Mapping

## Principle

ListingSyncer sits between Tools (consumer) and third-party platforms (DA, Bing,
Yelp, etc.). When a third-party call fails, LS must not blindly forward the raw
error code or always return 502. Instead, it maps the third-party status code to a
meaningful LS response so Tools can handle each case correctly without retrying.

**Key rule:** Only return 5xx to Tools when the failure is on LS's own side (unhandled
exception, bug, infrastructure). Third-party failures get specific 4xx or 502 codes
so Tools can distinguish them and avoid wasteful retries.

---

## Standard mapping table

Apply this table in every integration's controller/handler when catching an API
exception that carries an upstream HTTP status code.

| Third-party status | Meaning | LS → Tools response |
|--------------------|---------|---------------------|
| 401 Unauthorized | Credentials rejected by third party | **403 Forbidden** |
| 403 Forbidden | Access denied by third party | **403 Forbidden** |
| 400 Bad Request | LS sent malformed/invalid data | **400 Bad Request** |
| 404 Not Found | Resource not found at third party | **404 Not Found** |
| 5xx Server Error | Third party is down or has a bug | **502 Bad Gateway** |
| Network error / no response (code 0) | Third party unreachable | **502 Bad Gateway** |
| LS unhandled exception | Bug or crash in LS itself | **500 Internal Server Error** |

### Log levels

Match the log level to the severity of the mapped response:

| Mapped response | Log level |
|-----------------|-----------|
| 502 (third party down / unreachable) | `error` |
| 403 (credentials rejected) | `error` |
| 400 / 404 (expected / data issue) | `warning` |

---

## Implemented integrations

### Data Axle — `LookupController`

File: `src/Modules/DataAxle/Adapter/HTTP/LookupController.php`

```php
private function resolveErrorStatusCode(int $daStatusCode): int
{
    return match ($daStatusCode) {
        Response::HTTP_UNAUTHORIZED,
        Response::HTTP_FORBIDDEN   => Response::HTTP_FORBIDDEN,
        Response::HTTP_NOT_FOUND   => Response::HTTP_NOT_FOUND,
        Response::HTTP_BAD_REQUEST => Response::HTTP_BAD_REQUEST,
        default                    => Response::HTTP_BAD_GATEWAY,
    };
}
```

Exception type: `SearchApiException` (carries `$statusCode` from DA API).
Introduced in: LM-3998.

---

## Adding a new integration

1. Identify the exception type thrown by the integration's `ApiClient` and confirm
   it carries the upstream HTTP status code.
2. Add a `resolveErrorStatusCode(int $statusCode): int` private method to the
   controller or handler using the standard mapping table above.
3. Catch the exception, call `resolveErrorStatusCode()`, set log level based on the
   result, and return `$this->json(['error' => $e->getMessage()], $status)`.
4. Update the OpenAPI annotations on the endpoint to document the new response codes.
5. Add a test using a data provider that covers each mapping case — see
   `src/Modules/DataAxle/Test/Adapter/HTTP/LookupControllerTest.php` as a reference.

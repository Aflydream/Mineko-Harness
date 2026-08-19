# storage/ — non-session storage family

English | [中文](README.zh.md)

This family persists application data other than session event logs through named backends and typed data forms.

| Package | Role | ctx key |
|---|---|---|
| [`storage/`](storage/README.md) | Connects registered backends with typed data forms | `ctx.storage` |
| [`storage-json/`](storage-json/README.md) | Stores data in JSON files | registers backend `json` |
| [`storage-sqlite/`](storage-sqlite/README.md) | Stores data in SQLite | registers backend `sqlite` |
| [`storage-domain/`](storage-domain/README.md) | Provides validated domain-record storage | `ctx.storageDomain` |

Consumers use a data form rather than accessing a backend directly. The [domain storage decision](../../AgentGuide/architecture.md) records the family design.

The subsystem reference — the backend contract, `StorageForms`, `DomainSpec`/`Domain`, `domain/changed` — is [AgentGuide/reference/subsystems/storage.md](../../AgentGuide/reference/subsystems/storage.md).

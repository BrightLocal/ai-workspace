# Reference map — files to copy from, per phase

Model the new integration `<X>` on these. **Neustar (`epic/neustar`) is the most complete reference.**
Read files across branches with `git -C <repo> show <branch>:<path>` (don't switch branches mid-plan).
Tools = `products/Tools/codebase/Tools`, LS = `products/ListingSyncer/codebase/ListingSyncer`.

| Integration | Branch(es) | Notes |
|---|---|---|
| Neustar / Localeze | `epic/neustar` | Full scope incl. async backlinks + "mark Submitted" (LM-4202). Best reference. |
| Locafy / Hotfrog | `epic/locafy`, `task/LM-4162`, `task/LM-4173` | AUS-only; simpler; sync-on-save added in LM-4173. |
| DataAxle | `master` | Additional-data flow already wired; good for the Save&Sync DTO/updater shape. |

Replace `Neustar`/`neustar` with `<X>`/`<x>` throughout. Confirm each path still exists on the branch
(`git -C <repo> ls-tree -r --name-only <branch> | grep -i neustar`).

## Phase 1 — LS module: API client + endpoint (LS, `epic/neustar`)
- Module tree: `src/Modules/Neustar/` (`Domain/`, `Application/`, `Infrastructure/`, `Adapter/`)
- API client: `src/Modules/Neustar/Application/Service/API/` (`AuthenticatedClient`, `ListingClient`, `TokenClient`)
- Submission pipeline: `Application/Service/ListingService.php` (`upsert`), `ListingFactory`, `ListingValidator`, mappers under `Application/Service/Mappers/` (Locafy has `CategoryMapper`, `ImagesMapper`, `TradingHoursMapper`, `SocialProfilesMapper`)
- DTOs: `Application/DTO/` (`LocationData`, `AdditionalData`), API DTOs under `Application/Service/API/`
- Domain: `Domain/Entity/Request.php`, `Domain/Repository/…`, `Infrastructure/Repository/RequestRepository.php`
- HTTP: `Adapter/HTTP/ListingController.php` (`POST/PUT/GET /neustar/listing/{locationUUID}`, `/…/request-status`, failed-requests, categories)
- Config: `config/<Module>/services.yaml`, `config/routes.yaml`, `config/packages/doctrine.yaml`; `src/Constant/Integrations.php`
- Async extras: `SubmissionStatusChecker`, `PendingSubmissionChecker`, `src/Cron/…CheckSubmissionResults.php`
- Tools-side thin client: `src/Modules/Location/Application/Service/Integration/Neustar/ApiClient.php` (uses `listingSyncerHttpClient`; registered in `src/Modules/Location/Resources/config/services-symfony-loader.php` with the `%listingSyncer.*_timeout%` param)

## Phase 2 — Testing CLI (both repos)
- LS: `src/Modules/Neustar/Adapter/CLI/…` and Locafy's `LocafyPushListingCommand`, `LocafyUpdateListingCommand`, `LocafyCheckListingSubmissionCommand`, `LocafyRunSubmissionCheckerCommand`
- Tools: `src/Modules/Location/Adapter/Console/Neustar/…` (+ `DataAxle`) console commands

## Phase 3 — FF + availability (Tools, `epic/neustar`)
- Flag: `src/Config/Feature.php` (`LM_NEUSTAR_ENABLED = 'lm.neustar.enabled'`); seed migration modelled on the `feature_flags` INSERT migration (`migration/doctrine/Version20260609120000.php`)
- Availability: `src/Modules/Location/Application/Query/Integration/Neustar/IsNeustarIntegrationAvailableQuery.php` + `…QueryHandler.php`
- Allowed countries: `src/Modules/LocationConnections/Application/Constant/Connection.php` (`ALLOWED_NEUSTAR_COUNTRIES`) + `src/Modules/LocationConnections/Application/Query/GetNeustarConnectionAllowedCountriesQuery(+Handler).php`
- Integration id: `src/Includes/Constant/Integration.php` (`NEUSTAR` + `NAME_MAP`)
- Surface: `src/Modules/LocationConnections/Application/Query/GetSupportedIntegrationsQueryHandler.php`
- Handlers auto-register via `src/HaploFramework/ServicesLoader.php` (no manual DI for query handlers)

## Phase 4 — connection trigger + AS enable (Tools + LS)
- Trigger (Tools): `src/Modules/Cb/Application/Listeners/NeustarConnectionRequestListener.php` (on `CampaignStatusUpdated`→`onCampaignInProgress`); DataAxle's uses `CampaignPurchasedEvent` — pick per the "in progress" requirement. Register in `src/Modules/Cb/Resources/config/services-symfony-loader.php`.
- Publisher/aggregator set: `src/Modules/Cb/Domain/Publisher/Entity/PublisherMetadata.php` (`AGGREGATOR_*`, `NETWORK_*`); directories in `Domain/Publisher/Entity/PublisherDirectory.php` (`SITES`)
- Connect command: `src/Modules/Location/Application/IntegrationCommand/Integration/Neustar/Connection/ConnectLocationCommand.php` (+ handler in `…/Command/Integration/Neustar/Connection/`). **Cross-module dispatch must use the `IntegrationCommand` layer** (Deptrac) — Locafy's promotion in LM-4162 is the worked example.
- AS-enable (Tools): `src/Modules/Location/Application/EventListener/NeustarActiveSyncListener.php` (on `Events::ON_LOCATION_NEUSTAR_SUBMITTED`/`…_CONNECTED` → `ToggleActiveSyncForConnectionCommand(…, Integration::NEUSTAR, true)`). Register in `src/Modules/Location/Resources/config/services-symfony-loader.php`.
- Toggle support: `src/Modules/Location/Application/Command/ActiveSync/ToggleActiveSyncForConnection/ToggleActiveSyncForConnectionHandler.php` (`hasConnection()` match arm) + `src/Modules/LocationManager/Dto/ActiveSync/ActiveSync.php` (field + `connection()` case + getter/setter) + `LocationConnections` `LocationConnections` DTO `getX()`
- AS-settings columns (LS-owned table): LS `src/Entity/Location/Settings/ActiveSync.php` embedded `x_` connection + `src/Migrations/Version*.php`; **plus the identical migration in Tools `migration/doctrine/`** (Neustar: LS `Version20260612120000` mirrors Tools). Response/DTO/transformer/form: LS `src/Service/Location/Settings/Dto/ActiveSyncSettings.php`, `ActiveSyncSettingsTransformer.php`, `src/Message/DTO/ActiveSyncDTO.php`, `src/Form/Location/Settings/ActiveSyncForm.php`.

## Phase 5 — Save & Sync (Tools + LS, `epic/neustar`)
- Tools build: `src/Modules/LocationManager/Services/AdditionalData/Updating/Transformers/DataTransformer.php` (sets `shouldSendToX` from `IsXIntegrationAvailableQuery`; adds `x` section via an `XTransformer`), `.../Updating/Dto/Metadata.php`, `.../Updating/Dto/AdditionalData.php`. **Use LocationManager-local DTOs** (`.../Updating/Dto/<X>/…`) — do NOT reuse the Location module's Integration DTOs (Deptrac; LM-4173 lesson). Outbound HTTP: `src/Modules/LocationManager/Services/AdditionalData/Client.php` (`POST /additional-data/locations/{uuid}`).
- LS consume + gate: `src/Form/AdditionalData/Dto/Metadata.php` (+ `MetadataType.php`), `src/Form/AdditionalData/Update.php` (+ `Dto/AdditionalData.php`), `src/Modules/<X>/Application/Service/AdditionalData/Updater.php` (mirror `Modules/Neustar/…/AdditionalData/Updater` or DataAxle's — gate on connection + `getX()->isActiveSyncEnabled()`), and the gated block in `src/Service/AdditionalData/UpdateDispatcher.php` (`if metadata->shouldSendToX` → sync, else log skip; bump `WaitGroup`).

## Phase 6 — mark Submitted on connection creation (LS → RabbitMQ → Tools)
- LS producer: `src/Modules/Neustar/Application/Message/NeustarConnectionCreated.php` dispatched from `ListingService::upsert()` inside the new-connection branch; AMQP transport/routing in `config/packages/messenger.yaml` (copy the `Lm…` block).
- Tools consumer: `workers-mq/Lm<X>ConnectionCreated` (filename == queue name, perms 777) + `src/Modules/Location/Adapter/Worker/…ConnectionCreated.php` (extends `LiteWorker`) + handler → CB IntegrationCommand `Modules\Cb\Application\IntegrationCommand\Publisher\MarkPublisherDirectoriesSubmitted\MarkPublisherDirectoriesSubmittedHandler` (LM-4202) — flips `To Do → Submitted`, never downgrades `Live`, and **includes the aggregator's own directory** (`AGGREGATOR_*`), not just its networks. Register queue in `QueueTeamMapping`.

## Phase 7 — backlinks after processing
- Neustar live/backlink flow (LM-4164): the publish path that upgrades `Submitted → Live` with URLs — LS `src/Modules/Neustar/…` publications sync + `NeustarListingPublished` message → Tools `NeustarListingPublishedHandler` / `PublisherSubmissionUpdater`. GPS-style networks that never return a backlink stay `Submitted`.
- **Sync APIs**: the submit response may already carry directory URLs — update the CB campaign publisher directories directly instead of via the async publish flow.

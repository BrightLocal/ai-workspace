# Connected Locations (CL) Team — Code Entry Points

**Team:** Connected Locations (CL)
**Jira prefix:** `LM` (e.g. LM-4033)

Team areas of responsibility: Location Manager · Add Location Wizard + GBP Import · Active Sync · Connections (GBP, Facebook, Bing, Apple, Yelp) · All Locations · Bulk Management

---

## Repos

| Repo | Stack |
|---|---|
| **Tools** | PHP 8.3 + HaploFramework (Symfony-based) modular monolith, React/Redux/TypeScript frontend, RabbitMQ workers |
| **ListingSyncer** | Symfony microservice, Doctrine ORM, Symfony Messenger + RabbitMQ, Swoole HTTP server |

---

## 1. Location Manager

### Tools — Backend
| File | Purpose |
|---|---|
| `src/Modules/LocationManager/` | Core module — ActiveSync services, additional data fetching/updating |
| `src/Modules/LocationManager/Services/AdditionalData/Fetching/` | Per-platform data fetchers (Apple, Bing, Facebook, GMB, Yelp) |
| `src/Modules/LocationManager/Services/AdditionalData/Updating/` | Per-platform update transformers |
| `src/Modules/LocationManager/Services/ActiveSync/` | Health checks, HTTP client factory, request logging |
| `src/Modules/LocationManager/Services/ActiveSync/ListingUpdate/Client.php` | HTTP client to ListingSyncer |
| `src/Modules/LocationManager/Dto/ActiveSync/` | DTOs for ActiveSync requests, connections, validation errors |
| `src/App/LocationDashboard/Services/Location/LocationDataGenerator.php` | Generate location data for UI |
| `src/App/LocationDashboard/Services/Location/LocationUpdater.php` | Handle location updates |
| `src/App/LocationDashboard/Services/Location/LocationInitialiser.php` | Initialize location settings |
| `src/App/LocationDashboard/Services/Location/AdditionalDataGenerator.php` | Generate additional field data |
| `src/App/LocationDashboard/Services/Location/Manager/` | Platform-specific managers (Gmb, Bing, Facebook, Apple) |
| `src/App/LocationDashboard/Actions/Location/Data.php` | GET location data |
| `src/App/LocationDashboard/Actions/Location/Edit.php` | Edit location |
| `src/App/LocationDashboard/Actions/Location/Publish.php` | Publish location |

### Tools — Frontend
| File | Purpose |
|---|---|
| `src/App/LocationDashboard/Resources/assets-v2/location_manager/` | Main location manager SPA root |
| `.../components/ActiveSyncControlPanel.tsx` | ActiveSync settings and controls |
| `.../components/core_information_tab/` | Address, phone, hours, additional data sections |
| `.../components/core_information_tab/additional_data_section/` | GMB attributes, Facebook data, Yelp data |
| `.../components/connections_tab/` | Platform connection status |
| `.../components/sync_status_monitor/` | Monitor sync status changes |
| `.../components/alerts/` | Alert components |
| `.../reducers/` | Redux state management |
| `.../middleware/` | Redux middleware |

### ListingSyncer
| File | Purpose |
|---|---|
| `src/Controller/Location/SettingsController.php` | GET/PUT active-sync settings, batch settings |
| `src/Controller/Location/ConnectionsController.php` | View/manage connections |
| `src/Controller/Location/UpdateController.php` | Update requests/results |
| `src/Service/Location/Settings/ActiveSyncSettingsFinder.php` | Find settings |
| `src/Service/Location/Settings/ActiveSyncSettingsGenerator.php` | Generate settings data |
| `src/Service/Location/Settings/ActiveSyncSettingsUpdater.php` | Update settings |
| `src/Service/Location/Settings/ActiveSyncSettingsTransformer.php` | Transform settings |
| `src/Service/Location/Connections/ConnectionsProvider.php` | Aggregate all connections for a location |
| `src/Entity/Location/Settings/ActiveSync.php` | ActiveSync settings entity |
| `src/Entity/Location/Settings/ActiveSyncConnection.php` | Connection entity |
| `src/Repository/Location/Settings/ActiveSyncRepository.php` | Settings repository |

---

## 2. Add Location Wizard (ALW) + GBP/GMB Import

### Tools — Backend
| File | Purpose |
|---|---|
| `src/App/ClientsLocations/Service/GmbImport/LocationsImporter/LocationsImporter.php` | Main GBP import handler |
| `src/App/ClientsLocations/Service/GmbImport/LocationsImporter/RequestTransformer.php` | Transform import requests |
| `src/App/ClientsLocations/Service/GmbImport/LocationsImporter/ResponseTransformer.php` | Transform import responses |
| `src/App/ClientsLocations/Service/GmbImport/ClLocationMapper/ClLocationMapper.php` | Map GBP locations to CL locations |
| `src/App/ClientsLocations/Service/GmbImport/LocationsStatsAggregator/` | Aggregate import stats |
| `src/App/ClientsLocations/Actions/Bulk/Import.php` | Bulk import endpoint |
| `src/App/ClientsLocations/Actions/Bulk/Upload.php` | File upload endpoint |
| `src/App/ClientsLocations/Actions/Bulk/UploadPing.php` | Monitor upload progress |
| `src/App/ClientsLocations/Service/Creator/GooglePlaceCreator.php` | Create location from Google Place |
| `src/App/ClientsLocations/Service/GooglePlaceLinker/` | Link Google Places to locations |
| `src/App/ClientsLocations/Service/GooglePlaceActualizer.php` | Update location from Google Place |
| `src/Modules/LocationConnections/Adapter/Http/GMB/` | GMB connection endpoints |
| `src/Modules/API/Manage/Location/Adapter/Http/V1/Location/CreateLocationFromPlaceId.php` | Create from Place ID |
| `src/Modules/API/Manage/Location/Adapter/Http/V1/Location/CreateLocationFromMapsUrl.php` | Create from Maps URL |

### Tools — Frontend
| File | Purpose |
|---|---|
| `frontend/shared/location_wizard/LocationWizard/AddLocation/FindGbpListings/` | Find GBP listings step |
| `frontend/shared/location_wizard/LocationWizard/AddLocation/ImportGbpLocations/` | Import GBP locations step |
| `frontend/shared/location_wizard/LocationWizard/AddLocation/ConnectGbpLocation/` | Connect GBP location step |
| `frontend/shared/location_wizard/LocationWizard/AddLocation/WithFindLocation/` | Find location in Google Maps step |
| `frontend/shared/location_wizard/LocationWizard/store.ts` | Wizard Redux store |
| `frontend/shared/location_wizard/LocationWizard/api.ts` | Wizard API calls |
| `src/App/ClientsLocations/Resources/assets-v2/src/gmb-import/` | Bulk GBP import UI |
| `frontend/components/gmb_search_location/` | GMB location search |
| `frontend/components/gmb-select-loc/` | GMB location selector |
| `frontend/components/find_location/` | Find location (reusable) |

### ListingSyncer
| File | Purpose |
|---|---|
| `src/Controller/Google/LocationController.php` | POST/GET/PUT/DELETE GMB locations |
| `src/Controller/Google/GMBController.php` | GMB account management |
| `src/Service/Google/GMB/Location/Generator.php` | Create new locations |
| `src/Service/Google/GMB/Location/Connector.php` | Connect locations to accounts |
| `src/Service/Google/GMB/Location/Reconnector.php` | Reconnect to different accounts |
| `src/Service/Google/GMB/LocationFetcher.php` | Fetch from Google API |
| `src/Service/Google/GMB/LocationsManager.php` | Manage location lifecycle |
| `src/Service/Google/GMB/GoogleLocationTransformer.php` | Transform Google API responses |
| `src/Service/Google/GMB/Account/Fetcher.php` | Fetch GMB accounts |
| `src/Entity/Gmb/Location.php` | GMB location entity |
| `src/Entity/Gmb/Account.php` | GMB account entity |
| `src/Repository/Gmb/LocationRepository.php` | Location repository |

---

## 3. Active Sync

### Tools — Backend
| File | Purpose |
|---|---|
| `src/Modules/LocationManager/Services/ActiveSync/` | Health checks, HTTP client factory, request logging |
| `src/Modules/LocationManager/Services/ActiveSync/Apple/ProfileStateToLocationConverter.php` | Convert Apple profile → location |
| `src/Modules/LocationManager/Services/ActiveSync/Bing/ProfileStateToLocationConverter.php` | Convert Bing profile → location |
| `src/Modules/LocationManager/Services/ActiveSync/Statistics/ASCapabilityActivatedTracker.php` | Track AS capability activation |
| `src/Modules/API/Manage/ActiveSync/Adapter/Http/V1/SwitchSettings.php` | Toggle ActiveSync on/off |
| `src/Modules/API/Manage/Location/Adapter/Http/V1/Location/ActiveSync/Alerts.php` | Get alerts |
| `src/Modules/API/Manage/Location/Adapter/Http/V1/Location/ActiveSync/CancelSyncRequest.php` | Cancel pending sync |
| `src/App/LocationDashboard/Services/Location/Manager/ActiveSync/Setting/Generator.php` | Generate ActiveSync settings data |
| `src/App/LocationDashboard/Services/Location/Manager/ActiveSync/Subscription/CapabilityActualizer.php` | Update subscription capabilities |
| `src/App/LocationDashboard/Services/Location/Manager/ActiveSync/ExternalUpdate/Handler/` | Platform external update handlers (Apple, Bing, Facebook, Gmb) |
| `src/App/LocationDashboard/Services/Location/Manager/ActiveSync/Emails/` | Notification emails |
| `src/App/ClientsLocations/Service/ActiveSync/AlertActionApplier.php` | Apply single alert action |
| `src/App/ClientsLocations/Service/ActiveSync/BulkAlertActionsApplier.php` | Apply bulk alert actions |
| `src/App/ClientsLocations/Actions/AlertInbox/AlertInbox.php` | Get alert inbox |
| `src/App/ClientsLocations/Actions/AlertInbox/Alerts.php` | List alerts |
| `src/App/ClientsLocations/Actions/AlertInbox/ApplyAlertActions.php` | Apply user actions |
| `src/App/ClientsLocations/Actions/AlertInbox/ApplyAlertStatus.php` | Update alert status |
| `src/App/ClientsLocations/Workers/AlertInbox/LocationAlertsAction.php` | Process alert actions worker |

### Tools — Frontend
| File | Purpose |
|---|---|
| `.../location_manager/components/ActiveSyncControlPanel/` | Main ActiveSync control panel |
| `.../location_manager/components/ActiveSyncUpdatingDialogContent/` | Updating dialog |
| `.../location_manager/components/sync_status_alerts/` | Sync status alerts |
| `.../location_manager/components/sync_status_monitor/` | Monitor sync status |
| `.../location_manager/components/pending_update_notification/` | Pending update notification |
| `frontend/components/ActiveSyncPromotion/` | Promotion banner |
| `frontend/components/ActiveSyncPromotionCard/` | Promotion card |
| `frontend/components/ActiveSyncPromotionPopup/` | Promotion popup |

### ListingSyncer
| File | Purpose |
|---|---|
| `src/Service/Location/ActiveSync/Updates/Syncer.php` | Sync updates to platforms |
| `src/Service/Location/ActiveSync/Updates/SyncerFactory.php` | Factory for syncers |
| `src/Service/Location/ActiveSync/Updates/Creator.php` | Create update records |
| `src/Service/Location/ActiveSync/Updates/FailedUpdatesArchiver.php` | Archive failed updates |
| `src/Service/Location/ActiveSync/Updates/FailedUpdatesPusher.php` | Retry failed updates |
| `src/Service/Location/ActiveSync/Requests/Creator.php` | Create AS requests |
| `src/Worker/MessageHandler/CheckForGmbUpdatesHandler.php` | Handle GMB update checks |
| `src/Worker/MessageHandler/CheckForAppleUpdatesHandler.php` | Handle Apple update checks |
| `src/Worker/MessageHandler/CheckForYelpUpdatesHandler.php` | Handle Yelp update checks |
| `src/Worker/MessengerConsumer/ASCheckGmbUpdatesWorker.php` | GMB queue consumer |
| `src/Worker/MessengerConsumer/ASCheckAppleUpdatesWorker.php` | Apple queue consumer |
| `src/Worker/MessengerConsumer/ASAdditionalDataUpdatesWorker.php` | Additional data consumer |
| `src/Cron/ActiveSyncPushFailedUpdates.php` | Retry failed updates cron |
| `src/Service/Metrics/ActiveSyncUsage.php` | AS usage metrics |
| `src/Entity/Location/ActiveSync/Request.php` | AS request entity |
| `src/Entity/Location/ActiveSync/Update.php` | AS update entity |
| `src/Entity/Location/ActiveSync/MediaUpdate.php` | AS media update entity |
| `src/Message/ActiveSyncSettingsUpdate.php` | Settings update message |
| `src/Message/UpdateCheckGmbMessage.php` | GMB update check message |
| `src/Message/UpdateCheckAppleMessage.php` | Apple update check message |
| `src/EventListener/Google/ActiveSyncSettingsListener.php` | AS settings event listener |

---

## 4. Connections

### Tools — Backend
| File | Purpose |
|---|---|
| `src/Modules/LocationConnections/Adapter/Http/GMB/` | GBP: Add, Connect, Reconnect, CheckConnection, RunFetching |
| `src/Modules/LocationConnections/Adapter/Http/Apple/` | Apple: Connect, Disconnect |
| `src/Modules/LocationConnections/Adapter/Http/Facebook/` | Facebook: ConnectAccount, CheckConnection |
| `src/Modules/LocationConnections/Adapter/Http/Yelp/` | Yelp: Connect, Create, Disconnect |
| `src/Modules/LocationConnections/Application/Query/GetConnectionsDataQuery.php` | Get all connection data |
| `src/Modules/LocationConnections/Application/Query/GetGBPConnectionQuery.php` | Get GBP connection |
| `src/Modules/LocationConnections/Application/Query/HasActiveSyncConnectionsQuery.php` | Check AS connections exist |
| `src/Modules/LocationConnections/Application/Service/ConnectionsGenerator.php` | Generate connections page data |
| `src/App/LocationDashboard/Services/Location/SocialConnector.php` | Connect social platforms |
| `src/App/LocationDashboard/Actions/Location/Manager/Gmb/` | GMB: FetchAdditionalData, FetchSABStatus, RefreshAttributes |
| `src/App/LocationDashboard/Actions/Location/Manager/Apple/` | Apple: FetchAdditionalData, FetchProfile, Lookup (Run/Status/Cancel) |
| `src/App/LocationDashboard/Actions/Location/Manager/Bing/` | Bing: FetchAdditionalData, Lookup (Run/Status/Cancel) |
| `src/App/LocationDashboard/Actions/Location/Manager/Facebook/` | Facebook: FetchAdditionalData, Categories |
| `src/App/LocationDashboard/Services/Gmb/LocationDisconnector.php` | Disconnect from GMB |
| `src/App/LocationDashboard/Services/Gmb/AccountDeleter.php` | Delete GMB account connection |

### Tools — Frontend
| File | Purpose |
|---|---|
| `frontend/shared/connections_integrations/components/ConnectionItem/` | Single connection display |
| `frontend/shared/connections_integrations/components/connection_list/` | Connections list |
| `frontend/shared/connections_integrations/components/connection_errors/` | Error messages |
| `frontend/shared/connections_integrations/ducks/` | Redux (actions, reducers, selectors) |
| `.../location_manager/components/connections_tab/` | Connections tab in location manager |
| `frontend/components/gmb-connect/` | GMB connection component |
| `frontend/shared/google-oauth/` | Google OAuth flow |

### ListingSyncer — GBP/GMB
| File | Purpose |
|---|---|
| `src/Controller/Google/LocationController.php` | Connect, reconnect, disconnect, check status |
| `src/Service/Google/Connection/Checker.php` | Check connection status |
| `src/Service/Google/Connection/AllConnectionsChecker.php` | Bulk connection check |
| `src/Service/Google/GMB/Location/Connector.php` | Connect location |
| `src/Service/Google/GMB/Account/Disconnecter.php` | Disconnect account |
| `src/Service/Location/Connections/GMB.php` | GMB connection DTO |
| `src/Service/Location/Connections/GMBConnectionErrorGenerator.php` | Error generation |
| `src/Cron/CheckConnectionStatus.php` | Periodic connection checks |

### ListingSyncer — Facebook
| File | Purpose |
|---|---|
| `src/Controller/Facebook/AccountController.php` | Create/list/delete accounts |
| `src/Controller/Facebook/PageController.php` | Create/list/delete pages |
| `src/Controller/Facebook/AccountLocationController.php` | Account-location mapping |
| `src/Service/Facebook/LocationConnector.php` | Connect location to page |
| `src/Service/Facebook/Connection/AllConnectionsChecker.php` | Bulk connection check |
| `src/Entity/Facebook/Account.php` | Account entity |
| `src/Entity/Facebook/AccountLocation.php` | Account-location mapping entity |
| `src/Service/Location/Connections/Facebook.php` | Facebook connection DTO |
| `src/Cron/FacebookDelayedPageDataUpdate.php` | Delayed page data updates |

### ListingSyncer — Bing
| File | Purpose |
|---|---|
| `src/Modules/Bing/Adapter/HTTP/ConnectionController.php` | Create/delete connections |
| `src/Modules/Bing/Adapter/HTTP/ListingsController.php` | Listing sync |
| `src/Modules/Bing/Application/Service/Connection/Connector.php` | Create connections |
| `src/Modules/Bing/Application/Service/Connection/Disconnector.php` | Disconnect |
| `src/Modules/Bing/Application/Service/Connection/ClaimStatusChecker.php` | Check claim status |
| `src/Modules/Bing/Domain/Entity/Connection.php` | Connection entity |
| `src/Service/Location/Connections/Bing.php` | Bing connection DTO |
| `src/Modules/Bing/Adapter/CLI/BingCheckConnectionClaimStatusCommand.php` | CLI claim check |

### ListingSyncer — Apple Maps
| File | Purpose |
|---|---|
| `src/Controller/Apple/ConnectionController.php` | Create/delete connections |
| `src/Controller/Apple/LocationController.php` | Location operations |
| `src/Service/Apple/Connection/Disconnector.php` | Disconnect |
| `src/Service/Apple/Listing/Sync/UpdateArchiver.php` | Archive sync updates |
| `src/Entity/Apple/Connection.php` | Connection entity |
| `src/Entity/Apple/Listing.php` | Listing entity |
| `src/Service/Location/Connections/Apple.php` | Apple connection DTO |
| `src/Command/Apple/AppleApiPushListingCommand.php` | Push listing to Apple |

### ListingSyncer — Yelp
| File | Purpose |
|---|---|
| `src/Controller/Yelp/ConnectionController.php` | Create/delete connections |
| `src/Controller/Yelp/LocationController.php` | Create/update/list locations |
| `src/Service/Yelp/Creator.php` | Create Yelp connections/listings |
| `src/Service/Yelp/Disconnector.php` | Disconnect |
| `src/Service/Yelp/BusinessUpdater.php` | Update listings |
| `src/Service/Yelp/IngestionStatusChecker.php` | Check async job status |
| `src/Entity/Yelp/Connection.php` | Connection entity |
| `src/Entity/Yelp/Location.php` | Location entity |
| `src/Service/Location/Connections/Yelp.php` | Yelp connection DTO |
| `src/Worker/MessageHandler/CheckForYelpUpdatesHandler.php` | Handle Yelp update checks |
| `src/Worker/MessageHandler/CheckYelpIngestionStatusHandler.php` | Check ingestion status |
| `src/Worker/MessengerConsumer/ASCheckYelpIngestionStatusWorker.php` | Yelp ingestion consumer |

---

## 5. All Locations Page

### Tools — Backend
| File | Purpose |
|---|---|
| `src/App/LocationDashboard/Actions/AllLocations/Home.php` | Main all locations page |
| `src/App/LocationDashboard/Actions/AllLocations/LocationList.php` | Location list endpoint |
| `src/App/LocationDashboard/Actions/AllLocations/Metrics.php` | Metrics endpoint |
| `src/App/LocationDashboard/Actions/AllLocations/UpdateStatus.php` | Update location status |
| `src/App/LocationDashboard/Actions/AllLocations/CloseActiveSyncPromo.php` | Dismiss AS promo |
| `src/App/LocationDashboard/Actions/Api/Locations.php` | Locations list API |
| `src/App/LocationDashboard/Services/AllLocations/LocationsTransformer.php` | Transform location data for display |
| `src/App/LocationDashboard/Services/AllLocations/Elastic/ConnectionsIndexer.php` | Index connection status |
| `src/App/LocationDashboard/Services/AllLocations/Elastic/GmbIndexer.php` | Index GMB data |
| `src/App/LocationDashboard/Services/AllLocations/Elastic/AlertsMetricsReindexer.php` | Reindex alert metrics |
| `src/App/LocationDashboard/Services/AllLocations/MetricsProvider/ConnectionsMetricsProvider.php` | Connection metrics |
| `src/App/LocationDashboard/Services/AllLocations/MetricsProvider/AlertsMetricsProvider.php` | Alert metrics |
| `src/App/LocationDashboard/Services/AllLocations/EndpointsGenerator.php` | Generate endpoints for UI |
| `src/App/LocationDashboard/Services/AllLocations/ActiveSyncPromo.php` | AS promotion data |

### Tools — Frontend
| File | Purpose |
|---|---|
| `assets-v2/locations_overview/spa_root_component.js` | SPA root |
| `assets-v2/locations_overview/components/page_header/TabLocationsHeader/` | Tab navigation |
| `assets-v2/locations_overview/components/table/` | Locations table |
| `assets-v2/locations_overview/components/table/active_sync_alerts_cell/` | AS alerts cell |
| `assets-v2/locations_overview/components/active_sync_claim_modal/` | AS promotion modal |
| `assets-v2/locations_overview/components/alerts_notification/` | Alert notifications |
| `assets-v2/locations_overview/middleware/locations_fetcher.js` | Fetch locations |
| `assets-v2/locations_overview/middleware/locations_handler.js` | Handle location updates |
| `assets-v2/locations_overview/middleware/alerts_fetcher.js` | Fetch alerts |
| `assets-v2/locations_overview/middleware/location_status_attribute_changer.js` | Change location status |
| `frontend/shared/active-locations-selector/` | Multi-location selector |
| `frontend/components/locations-table/` | Reusable locations table |

### ListingSyncer
| File | Purpose |
|---|---|
| `src/Controller/Location/ConnectionsController.php` | GET single + POST bulk connections |
| `src/Controller/Location/SettingsController.php` (`POST /locations/settings`) | Batch get settings |
| `src/Service/Location/Connections/ConnectionsProvider.php` | Aggregate all connections |
| `src/Form/Location/Connections/ConnectionRequest.php` | Bulk connections request form |

---

## 6. Bulk Management (Locations)

### Tools — Backend
| File | Purpose |
|---|---|
| `src/App/ClientsLocations/Service/Bulk/LocationsImport.php` | Import locations from CSV |
| `src/App/ClientsLocations/Service/Bulk/ClientsImport.php` | Import clients |
| `src/App/ClientsLocations/Service/Bulk/ImportFactory.php` | Factory for import handlers |
| `src/App/ClientsLocations/Service/Bulk/FileStorage.php` | Handle file uploads |
| `src/App/ClientsLocations/Service/Bulk/OpeningHoursTransformer.php` | Transform opening hours |
| `src/App/ClientsLocations/Service/Bulk/ImportErrorsTransformer.php` | Transform validation errors |
| `src/App/ClientsLocations/Actions/Bulk/Import.php` | Bulk import endpoint |
| `src/App/ClientsLocations/Actions/Bulk/Upload.php` | File upload endpoint |
| `src/App/ClientsLocations/Actions/Bulk/UploadPing.php` | Check upload progress |
| `src/App/ClientsLocations/Command/ExportLocations.php` | Export locations |
| `src/App/ClientsLocations/Command/DeleteLocations.php` | Bulk delete |
| `src/App/Sysadmin/ActiveSync/BulkManagement/` | Sysadmin bulk AS operations |
| `src/App/Sysadmin/.../components/BulkActiveSyncSettings.tsx` | Bulk AS settings UI |

### Tools — Frontend
| File | Purpose |
|---|---|
| `frontend/shared/active-locations-selector/` | Multi-location selection |
| `src/App/ClientsLocations/Resources/assets-v2/location_wizard/` | Location wizard (handles bulk imports) |

### ListingSyncer
| File | Purpose |
|---|---|
| `src/Controller/Location/SettingsController.php` (`POST /locations/settings`) | Batch update settings |
| `src/Service/Location/Settings/ActiveSyncSettingsUpdater.php` | Bulk update logic |
| `src/Form/Location/Settings/BatchSettingsRequestForm.php` | Batch request form |
| `src/Modules/Bing/Adapter/HTTP/ListingsController.php` | Bulk Bing listings |
| `src/Modules/DataAxle/Adapter/HTTP/ListingController.php` | Bulk DataAxle listings |

---

## Key Infrastructure

### Tools
| File | Purpose |
|---|---|
| `config/services/services.php` | Main service container |
| `workers-mq/` | RabbitMQ workers root |
| `src/App/ClientsLocations/Workers/GmbImport/` | GMB import workers |

### ListingSyncer
| File | Purpose |
|---|---|
| `config/routes.yaml` | Routing |
| `config/packages/messenger.yaml` | Message queue setup |
| `config/services.yaml` | Service definitions |
| `src/Message/` | All message DTOs |
| `src/Worker/MessageHandler/` | Async message handlers |
| `src/Worker/MessengerConsumer/` | Queue consumers |
| `src/Cron/` | Scheduled jobs |
| `src/Service/AdditionalData/UpdateDispatcher.php` | Dispatch updates to all connections |
| `src/Service/AdditionalData/Fetcher.php` | Fetch additional data |

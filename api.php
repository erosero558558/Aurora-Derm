<?php

declare(strict_types=1);

require_once __DIR__ . '/api-lib.php';
require_once __DIR__ . '/payment-lib.php';
require_once __DIR__ . '/lib/monitoring.php';
require_once __DIR__ . '/lib/prediction.php';
require_once __DIR__ . '/lib/figo_utils.php';

// New Libs
require_once __DIR__ . '/lib/ApiConfig.php';
require_once __DIR__ . '/lib/api_helpers.php';
require_once __DIR__ . '/lib/ApiKernel.php';
require_once __DIR__ . '/lib/clinical_history/bootstrap.php';
require_once __DIR__ . '/lib/whatsapp_openclaw/bootstrap.php';

// Router
require_once __DIR__ . '/lib/Router.php';

// Controllers
require_once __DIR__ . '/controllers/HealthController.php';
require_once __DIR__ . '/controllers/PaymentController.php';
require_once __DIR__ . '/controllers/AdminDataController.php';
require_once __DIR__ . '/controllers/PatientCaseController.php';
require_once __DIR__ . '/controllers/TelemedicineAdminController.php';
require_once __DIR__ . '/controllers/TelemedicinePolicyController.php';
require_once __DIR__ . '/controllers/AppointmentController.php';
require_once __DIR__ . '/controllers/CallbackController.php';
require_once __DIR__ . '/controllers/ReviewController.php';
require_once __DIR__ . '/controllers/AvailabilityController.php';
require_once __DIR__ . '/controllers/ContentController.php';
require_once __DIR__ . '/controllers/ServiceCatalogController.php';
require_once __DIR__ . '/controllers/ServicePriorityController.php';
require_once __DIR__ . '/controllers/SystemController.php';
require_once __DIR__ . '/controllers/ConfigController.php';
require_once __DIR__ . '/controllers/OperatorAuthController.php';
require_once __DIR__ . '/controllers/OperatorPinController.php';
require_once __DIR__ . '/controllers/PushController.php';
require_once __DIR__ . '/controllers/AnalyticsController.php';
require_once __DIR__ . '/controllers/QueueController.php';
require_once __DIR__ . '/controllers/ClinicalHistoryController.php';
require_once __DIR__ . '/controllers/CaseMediaFlowController.php';
require_once __DIR__ . '/controllers/LeadAiController.php';
require_once __DIR__ . '/controllers/WhatsappOpenclawController.php';
require_once __DIR__ . '/controllers/AdminAgentController.php';

// Instantiate and Handle
$kernel = new ApiKernel();
$kernel->handleRequest();

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

// Router
require_once __DIR__ . '/lib/Router.php';

// Controllers
require_once __DIR__ . '/controllers/HealthController.php';
require_once __DIR__ . '/controllers/PaymentController.php';
require_once __DIR__ . '/controllers/AdminDataController.php';
require_once __DIR__ . '/controllers/AppointmentController.php';
require_once __DIR__ . '/controllers/CallbackController.php';
require_once __DIR__ . '/controllers/ReviewController.php';
require_once __DIR__ . '/controllers/AvailabilityController.php';
require_once __DIR__ . '/controllers/ContentController.php';
require_once __DIR__ . '/controllers/SystemController.php';
require_once __DIR__ . '/controllers/ConfigController.php';
require_once __DIR__ . '/controllers/PushController.php';
require_once __DIR__ . '/controllers/AnalyticsController.php';

// Instantiate and Handle
$kernel = new ApiKernel();
$kernel->handleRequest();

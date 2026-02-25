'use strict';

function handleSyncCommand(ctx) {
    const { syncDerivedQueues } = ctx;
    syncDerivedQueues({ silent: false });
}

module.exports = {
    handleSyncCommand,
};

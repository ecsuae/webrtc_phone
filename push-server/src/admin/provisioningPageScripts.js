'use strict';

const { CREATE_SCRIPT } = require('./provisioningPageCreateScripts');
const { ROW_SCRIPT } = require('./provisioningPageAccountRowScripts');
const { DEVICE_SCRIPT } = require('./provisioningPageDeviceRowScripts');

const CLIENT_SCRIPT = `<script>
${CREATE_SCRIPT}
${ROW_SCRIPT}
${DEVICE_SCRIPT}
</script>`;

module.exports = { CLIENT_SCRIPT };

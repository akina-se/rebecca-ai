const { CloudTasksClient } = require('@google-cloud/tasks');
const config = require('../config');

// Delay loading to avoid errors in dev without credentials
let client = null;

const getClient = () => {
    if (!client) {
        try {
            client = new CloudTasksClient();
        } catch (e) {
            console.warn("Cloud Tasks Client could not be initialized:", e.message);
        }
    }
    return client;
}

const enqueueReplyTask = async (payload, delaySeconds = 0) => {
    const project = config.gcp.projectId;
    const queue = config.gcp.queueName;
    const location = config.gcp.location;
    const url = `${config.gcp.workerUrl}/worker/reply`;

    if (!project || !queue || !location || !config.gcp.workerUrl) {
        console.warn('Cloud Tasks configuration missing. Mocking enqueue.');
        return { name: 'mock_task_id' };
    }

    const cTasksClient = getClient();
    if (!cTasksClient) return { name: 'mock_task_id' };

    const parent = cTasksClient.queuePath(project, location, queue);

    const task = {
        httpRequest: {
            httpMethod: 'POST',
            url,
            headers: {
                'Content-Type': 'application/json',
            },
            body: Buffer.from(JSON.stringify(payload)).toString('base64'),
        },
    };

    if (delaySeconds > 0) {
        task.scheduleTime = {
            seconds: delaySeconds + Date.now() / 1000,
        };
    }

    try {
        const [response] = await cTasksClient.createTask({ parent, task });
        console.log(`Created task ${response.name}`);
        return response;
    } catch (error) {
        console.error('Error enqueuing task:', error);
        throw error;
    }
};

module.exports = {
    enqueueReplyTask
};

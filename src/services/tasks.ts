import { CloudTasksClient  } from '@google-cloud/tasks';
import config from '../config';

/**
 * Cloud Tasks client instance.
 * Initialized lazily to prevent errors in environments without credentials.
 */
let client = null;

/**
 * Retrieves the Cloud Tasks client instance, initializing it if necessary.
 * 
 * @returns The active Cloud Tasks client instance or null if initialization fails.
 */
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

/**
 * Enqueues a reply task to be processed asynchronously.
 * 
 * @param payload - The payload data to be sent with the task.
 * @param delaySeconds - Number of seconds to delay the task execution. Defaults to 0.
 * @returns A promise that resolves to the created task response or a mock object if configuration is missing.
 * @throws Will throw an error if the task creation fails.
 */
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
        // @ts-expect-error scheduleTime expects specific proto format but basic structure works
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

export { 
    enqueueReplyTask
 };

import { enqueueReplyTask } from '../../src/services/tasks';
import config from '../../src/config';

// Mock CloudTasksClient
const mockCreateTask = jest.fn();
const mockQueuePath = jest.fn();

jest.mock('@google-cloud/tasks', () => {
    return {
        CloudTasksClient: jest.fn().mockImplementation(() => {
            return {
                createTask: mockCreateTask,
                queuePath: mockQueuePath
            };
        })
    };
});

describe('Cloud Tasks Service', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let originalConfig: any;

    beforeEach(() => {
        originalConfig = { ...config.gcp };
        jest.clearAllMocks();
        mockQueuePath.mockReturnValue('mock/queue/path');
    });

    afterEach(() => {
        config.gcp = originalConfig;
    });

    it('should return mock task id if config is missing', async () => {
        config.gcp.projectId = '';
        const result = await enqueueReplyTask({ test: 'payload' });
        expect(result).toEqual({ name: 'mock_task_id' });
    });

    it('should create task without delay', async () => {
        mockCreateTask.mockResolvedValue([{ name: 'real_task_id' }]);
        const result = await enqueueReplyTask({ test: 'payload' });
        expect(result).toEqual({ name: 'real_task_id' });
        expect(mockCreateTask).toHaveBeenCalled();
        const callArgs = mockCreateTask.mock.calls[0][0];
        expect(callArgs.task.scheduleTime).toBeUndefined();
    });

    it('should create task with delay', async () => {
        mockCreateTask.mockResolvedValue([{ name: 'delayed_task_id' }]);
        const result = await enqueueReplyTask({ test: 'payload' }, 60);
        expect(result).toEqual({ name: 'delayed_task_id' });
        expect(mockCreateTask).toHaveBeenCalled();
        const callArgs = mockCreateTask.mock.calls[0][0];
        expect(callArgs.task.scheduleTime).toBeDefined();
        expect(callArgs.task.scheduleTime.seconds).toBeGreaterThan(Date.now() / 1000);
    });

    it('should throw an error if createTask fails', async () => {
        mockCreateTask.mockRejectedValue(new Error('Task Error'));
        await expect(enqueueReplyTask({ test: 'payload' })).rejects.toThrow('Task Error');
    });
});

import { ReplyTaskController } from '../../src/features/reply/controller';
import { ReplyTaskUseCase } from '../../src/features/reply/usecase';
import { Request, Response } from 'express';

describe('ReplyTaskController', () => {
    let mockUseCase: jest.Mocked<ReplyTaskUseCase>;
    let controller: ReplyTaskController;
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;

    beforeEach(() => {
        mockUseCase = {
            execute: jest.fn().mockResolvedValue({ status: 'success' }),
        } as unknown as jest.Mocked<ReplyTaskUseCase>;

        controller = new ReplyTaskController(mockUseCase);

        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
    });

    it('should return 400 if required payload fields are missing', async () => {
        mockReq = {
            body: { tweetId: '123', text: 'hello' }, // missing authorId
        };

        await controller.handle(mockReq as Request, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Missing required task payload fields' });
        expect(mockUseCase.execute).not.toHaveBeenCalled();
    });

    it('should successfully execute when valid payload without mediaUrls is provided', async () => {
        mockReq = {
            body: { tweetId: '123', text: 'hello', authorId: 'user_1' },
        };

        await controller.handle(mockReq as Request, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith({ status: 'success' });
        expect(mockUseCase.execute).toHaveBeenCalledWith({
            tweetId: '123',
            text: 'hello',
            authorId: 'user_1',
            mediaUrls: undefined,
        });
    });

    it('should successfully execute when valid mediaUrls with allowed domains are provided', async () => {
        mockReq = {
            body: {
                tweetId: '123',
                text: 'look at this image',
                authorId: 'user_1',
                mediaUrls: [
                    'https://pbs.twimg.com/media/photo.jpg',
                    'https://ton.twitter.com/pic.png',
                    'https://media.x.com/test.jpg',
                ],
            },
        };

        await controller.handle(mockReq as Request, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith({ status: 'success' });
        expect(mockUseCase.execute).toHaveBeenCalledWith({
            tweetId: '123',
            text: 'look at this image',
            authorId: 'user_1',
            mediaUrls: [
                'https://pbs.twimg.com/media/photo.jpg',
                'https://ton.twitter.com/pic.png',
                'https://media.x.com/test.jpg',
            ],
        });
    });

    it('should return 500 when mediaUrls contains a disallowed domain', async () => {
        mockReq = {
            body: {
                tweetId: '123',
                text: 'malicious link',
                authorId: 'user_1',
                mediaUrls: ['http://malicious-host.internal/secret.jpg'],
            },
        };

        await controller.handle(mockReq as Request, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal Server Error' });
        expect(mockUseCase.execute).not.toHaveBeenCalled();
    });

    it('should return 500 when mediaUrls contains a lookalike disallowed domain', async () => {
        mockReq = {
            body: {
                tweetId: '123',
                text: 'deceptive link',
                authorId: 'user_1',
                mediaUrls: ['https://evil-twimg.com/pic.jpg'],
            },
        };

        await controller.handle(mockReq as Request, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal Server Error' });
        expect(mockUseCase.execute).not.toHaveBeenCalled();
    });

    it('should return 500 when mediaUrls contains an invalid protocol', async () => {
        mockReq = {
            body: {
                tweetId: '123',
                text: 'ftp scheme',
                authorId: 'user_1',
                mediaUrls: ['ftp://pbs.twimg.com/pic.jpg'],
            },
        };

        await controller.handle(mockReq as Request, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal Server Error' });
        expect(mockUseCase.execute).not.toHaveBeenCalled();
    });

    it('should return 500 when useCase throws an internal error', async () => {
        mockUseCase.execute.mockRejectedValue(new Error('Database unavailable'));

        mockReq = {
            body: { tweetId: '123', text: 'hello', authorId: 'user_1' },
        };

        await controller.handle(mockReq as Request, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal Server Error' });
    });
});

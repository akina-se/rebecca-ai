import { Request, Response, NextFunction } from 'express';
import { batchAuth } from '../../../src/middleware/batchAuth';
import config from '../../../src/config';
import { OAuth2Client } from 'google-auth-library';

jest.mock('google-auth-library');

describe('batchAuth Middleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let nextFunction: NextFunction;

    beforeEach(() => {
        mockReq = {
            headers: {}
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        nextFunction = jest.fn();
        jest.clearAllMocks();
        config.batchSecret = 'test_secret';
        config.gcp.workerUrl = 'https://test-worker.url';
    });

    it('should allow access if OIDC token is valid', async () => {
        mockReq.headers = { authorization: 'Bearer valid_token' };
        
        const mockVerifyIdToken = jest.fn().mockResolvedValue({
            getPayload: () => ({ iss: 'https://accounts.google.com' })
        });
        (OAuth2Client.prototype.verifyIdToken as jest.Mock) = mockVerifyIdToken;

        await batchAuth(mockReq as Request, mockRes as Response, nextFunction);

        expect(mockVerifyIdToken).toHaveBeenCalledWith({
            idToken: 'valid_token',
            audience: 'https://test-worker.url'
        });
        expect(nextFunction).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should fall back to shared secret if OIDC token is invalid', async () => {
        mockReq.headers = { 
            authorization: 'Bearer invalid_token',
            'x-batch-secret': 'test_secret'
        };
        
        const mockVerifyIdToken = jest.fn().mockRejectedValue(new Error('Invalid token'));
        (OAuth2Client.prototype.verifyIdToken as jest.Mock) = mockVerifyIdToken;

        await batchAuth(mockReq as Request, mockRes as Response, nextFunction);

        expect(nextFunction).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should block access if both OIDC token and shared secret are missing/invalid', async () => {
        mockReq.headers = { 
            'x-batch-secret': 'wrong_secret'
        };

        await batchAuth(mockReq as Request, mockRes as Response, nextFunction);

        expect(nextFunction).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should handle internal errors gracefully', async () => {
        mockReq.headers = { authorization: 'Bearer valid_token' };
        
        (OAuth2Client.prototype.verifyIdToken as jest.Mock) = jest.fn().mockImplementation(() => {
            throw new Error('Unexpected error'); // Thrown outside of try-catch or something we force
        });
        // We will make getter throw an unhandled exception to trigger 500
        Object.defineProperty(mockReq, 'headers', {
            get: () => { throw new Error('Internal'); }
        });

        await batchAuth(mockReq as Request, mockRes as Response, nextFunction);

        expect(nextFunction).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal Server Error' });
    });
});

module.exports = {
  '/api/v1/support': { target: 'http://localhost:8082', secure: false, changeOrigin: true, logLevel: 'debug' },
  '/api': { target: 'http://localhost:8081', secure: false, changeOrigin: true, logLevel: 'debug' },
  '/support': { target: 'http://localhost:8082', secure: false, changeOrigin: true, logLevel: 'debug' }
};

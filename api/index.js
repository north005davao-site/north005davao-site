const requestHandler = require('../server.js');

module.exports = (req, res) => {
  try {
    return requestHandler(req, res);
  } catch (err) {
    console.error('Unhandled serverless request error in api/index.js:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'A server exception occurred: ' + (err.message || String(err)),
        status: 500
      }));
    }
  }
};

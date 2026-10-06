import { createServer } from 'node:http';

const port = Number(process.env.FAM_FETCH_FIXTURE_PORT ?? '8787');

const server = createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'text/plain' });
    response.end('fetch-fixture-ready');
    return;
  }

  response.writeHead(200, {
    'content-type': 'application/json',
    'content-length': '1024',
    connection: 'close',
  });
  response.write('{"id":1,"partial":');
  setTimeout(() => response.socket?.destroy(), 250);
});

server.listen(port, '0.0.0.0');

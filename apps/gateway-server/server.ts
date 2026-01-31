import Fastify from 'fastify';

const server = Fastify({
  logger: true,
});

server.get('/', async () => {
  return { status: 'ok', service: 'gateway-server' };
});

const port = Number(process.env.PORT) || 8080;
const host = '0.0.0.0';

server.listen({ port, host }, (err, address) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }
  server.log.info(`Server listening at ${address}`);
});

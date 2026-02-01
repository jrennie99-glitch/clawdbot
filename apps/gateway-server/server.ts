import Fastify from 'fastify';

const fastify = Fastify({ logger: true });

fastify.get('/', async () => {
  return { status: 'ok', service: 'gateway-server' };
});

const PORT = Number(process.env.PORT) || 8080;

const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Gateway server listening on port ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
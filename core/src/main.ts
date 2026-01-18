import { ENV } from './env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() { 
  const app = await NestFactory.create(AppModule); 

  // Gestione graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('\n\n🛑 Received SIGTERM, shutting down gracefully...');
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('\n\n🛑 Received SIGINT, shutting down gracefully...');
    await app.close();
    process.exit(0);
  });

  await app.listen(ENV.PORT); 

  console.log(`🚀 Application ${ENV.APPNAME} Vers. ${ENV.VERSION} on port:${ENV.PORT}`);

}
bootstrap();

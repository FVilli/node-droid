import { ENV } from './env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GitWatcherService } from './services/git-watcher.service';

async function bootstrap() {
  console.clear();
  console.log('\n');
  console.log('  ╔═══════════════════════════════════════════════════════════╗');
  console.log('  ║                                                           ║');
  console.log(`  ║                    🤖 ${ENV.APPNAME}                          ║`);
  console.log('  ║                                                           ║');
  console.log('  ║            Your Autonomous Node.js Code Assistant        ║');
  console.log('  ║                                                           ║');
  console.log('  ╚═══════════════════════════════════════════════════════════╝');
  console.log(`   Version: ${ENV.VERSION}`);
  console.log('\n');

  try {
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn']
    });

    const watcher = app.get(GitWatcherService);
    await watcher.start();

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

  } catch (error) {
    console.error('\n❌ Fatal error during bootstrap:', error);
    process.exit(1);
  }
}

bootstrap();
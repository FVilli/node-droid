// packages/core/src/services/monorepo-manager.service.ts

import { Injectable } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PackageInfo } from '../interfaces';
import { AIActivityLoggerService } from './ai-activity-logger.service';

const execAsync = promisify(exec);

@Injectable()
export class MonorepoManagerService {
    private currentRepoPath: string;

  private packagesCache: Map<string, string> = new Map(); // path -> package.json hash

  async initialize() {
    console.log('🔧 Initializing mono-repo...');
    
    // Installa le dipendenze iniziali
    await this.installDependencies();
    
    // Crea cache dei package.json
    await this.updatePackagesCache();
    
    console.log('✅ Mono-repo initialized');
  }

  setCurrentRepository(repoPath: string) {
    this.currentRepoPath = repoPath;
  }

  async installDependencies(scope?: string) {
    const cwd = scope ? path.join(this.currentRepoPath, scope) : this.currentRepoPath;
    
    console.log(`📦 Installing dependencies in ${scope || 'root'}...`);
    
    try {
      const { stdout, stderr } = await execAsync('npm install', { cwd });
      if (stderr && !stderr.includes('npm WARN')) {
        console.warn(`   ⚠️  ${stderr}`);
      }
      console.log('   ✅ Dependencies installed');
    } catch (error) {
      console.error(`   ❌ Failed to install dependencies: ${error.message}`);
      throw error;
    }
  }

  async checkAndInstallDependencies(changedFiles: string[]) {
    const packagesToUpdate: Set<string> = new Set();

    for (const file of changedFiles) {
      if (path.basename(file) === 'package.json') {
        const fullPath = path.join(this.currentRepoPath, file);
        const hasChanged = await this.hasPackageJsonChanged(fullPath);
        
        if (hasChanged) {
          const packageDir = path.dirname(file);
          packagesToUpdate.add(packageDir);
          console.log(`   📝 package.json changed in: ${packageDir}`);
        }
      }
    }

    if (packagesToUpdate.size > 0) {
      console.log(`\n📦 Updating dependencies for ${packagesToUpdate.size} package(s)...`);
      
      for (const pkg of packagesToUpdate) {
        await this.installDependencies(pkg === '.' ? undefined : pkg);
      }
      
      // Aggiorna la cache
      await this.updatePackagesCache();
    }
  }

  private async hasPackageJsonChanged(filePath: string): Promise<boolean> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const hash = this.hashString(content);
      const previousHash = this.packagesCache.get(filePath);
      
      return previousHash !== hash;
    } catch {
      return true; // Se non riesce a leggere, considera cambiato
    }
  }

  private async updatePackagesCache() {
    const packageJsonFiles = await this.findAllPackageJsons();
    
    for (const file of packageJsonFiles) {
      const content = await fs.readFile(file, 'utf-8');
      this.packagesCache.set(file, this.hashString(content));
    }
  }

  private async findAllPackageJsons(): Promise<string[]> {
    const files: string[] = [];
    
    async function scan(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        // Salta node_modules
        if (entry.name === 'node_modules' || entry.name === '.git') {
          continue;
        }
        
        if (entry.isDirectory()) {
          await scan(fullPath);
        } else if (entry.name === 'package.json') {
          files.push(fullPath);
        }
      }
    }
    
    await scan(this.currentRepoPath);
    return files;
  }

  async discoverPackages(): Promise<PackageInfo[]> {
    const packages: PackageInfo[] = [];
    const packageJsonFiles = await this.findAllPackageJsons();
    
    for (const file of packageJsonFiles) {
      const content = JSON.parse(await fs.readFile(file, 'utf-8'));
      const relativePath = path.relative(this.currentRepoPath, path.dirname(file));
      
      packages.push({
        name: content.name || path.basename(path.dirname(file)),
        path: relativePath || '.',
        hasChanged: false,
        scripts: content.scripts || {}
      });
    }
    
    return packages;
  }

  async getAffectedPackages(changedFiles: string[]): Promise<PackageInfo[]> {
    const allPackages = await this.discoverPackages();
    const affected: PackageInfo[] = [];
    
    for (const pkg of allPackages) {
      const pkgPath = pkg.path === '.' ? '' : pkg.path;
      
      // Verifica se qualche file cambiato appartiene a questo package
      const hasChanges = changedFiles.some(file => {
        if (pkgPath === '') {
          // Root package: considera solo file nella root, non nelle sottocartelle
          return !file.includes('/');
        }
        return file.startsWith(pkgPath + '/') || file === pkgPath;
      });
      
      if (hasChanges) {
        affected.push({ ...pkg, hasChanged: true });
      }
    }
    
    return affected;
  }

  async buildPackage(pkg: PackageInfo, logger: AIActivityLoggerService): Promise<boolean> {
    if (!pkg.scripts.build) {
      logger.log('info', `No build script for ${pkg.name}, skipping`);
      return true;
    }
    
    logger.log('info', `🔨 Building ${pkg.name}...`);
    
    const cwd = path.join(this.currentRepoPath, pkg.path);
    
    try {
      const { stdout } = await execAsync('npm run build', { 
        cwd,
        env: { ...process.env, CI: 'true' }
      });
      
      logger.log('info', `✅ Build successful for ${pkg.name}`);
      return true;
    } catch (error) {
      logger.log('error', `❌ Build failed for ${pkg.name}`);
      logger.log('detail', error.stdout || error.message);
      return false;
    }
  }

  async testPackage(pkg: PackageInfo, logger: AIActivityLoggerService): Promise<boolean> {
    if (!pkg.scripts.test) {
      logger.log('info', `No test script for ${pkg.name}, skipping`);
      return true;
    }
    
    logger.log('info', `🧪 Testing ${pkg.name}...`);
    
    const cwd = path.join(this.currentRepoPath, pkg.path);
    
    try {
      const { stdout } = await execAsync('npm test', { 
        cwd,
        env: { ...process.env, CI: 'true' }
      });
      
      logger.log('info', `✅ Tests passed for ${pkg.name}`);
      return true;
    } catch (error) {
      logger.log('error', `❌ Tests failed for ${pkg.name}`);
      logger.log('detail', error.stdout || error.message);
      return false;
    }
  }

  async lintPackage(pkg: PackageInfo, logger: AIActivityLoggerService): Promise<boolean> {
    if (!pkg.scripts.lint) {
      logger.log('info', `No lint script for ${pkg.name}, skipping`);
      return true;
    }
    
    logger.log('info', `🔍 Linting ${pkg.name}...`);
    
    const cwd = path.join(this.currentRepoPath, pkg.path);
    
    try {
      await execAsync('npm run lint', { cwd });
      logger.log('info', `✅ Lint passed for ${pkg.name}`);
      return true;
    } catch (error) {
      logger.log('error', `⚠️  Lint warnings/errors for ${pkg.name}`);
      logger.log('detail', error.stdout || error.message);
      return true; // Lint non blocca
    }
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
}
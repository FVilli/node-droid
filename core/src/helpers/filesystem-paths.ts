import * as path from 'path';

export class FileSystemPaths {
  static resolve(base: string, target: string): string {
    const full = path.resolve(base, target);
    if (!full.startsWith(base)) throw new Error('Path escape detected');
    return full;
  }
}

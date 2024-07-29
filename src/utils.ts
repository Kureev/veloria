import fs from 'fs'
import path from 'path'

export function findProjectRoot(currentDir: string): string {
  const rootDir = path.parse(currentDir).root
  let dir = currentDir

  while (dir !== rootDir) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      return dir
    }
    dir = path.dirname(dir)
  }

  throw new Error('Could not find package.json in any parent directory')
}

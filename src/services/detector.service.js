import YAML from 'yaml';

const STACK_DETECTORS = [
  {
    files: ['composer.json'],
    detect: (content) => {
      const pkg = JSON.parse(content);
      if (pkg.require?.['laravel/framework']) return { stack: 'laravel', role: 'backend', language: { name: 'php' } };
      if (pkg.require?.['symfony/framework-bundle']) return { stack: 'symfony', role: 'backend', language: { name: 'php' } };
      return { stack: 'php', role: 'backend', language: { name: 'php' } };
    },
  },
  {
    files: ['requirements.txt', 'pyproject.toml'],
    detect: (content) => {
      if (/django/i.test(content)) return { stack: 'django', role: 'backend', language: { name: 'python' } };
      if (/fastapi/i.test(content)) return { stack: 'fastapi', role: 'backend', language: { name: 'python' } };
      return { stack: 'python', role: 'backend', language: { name: 'python' } };
    },
  },
  {
    files: ['pom.xml', 'build.gradle'],
    detect: (content) => {
      if (/springframework.*boot/i.test(content)) return { stack: 'spring-boot', role: 'backend', language: { name: 'java' } };
      return { stack: 'java', role: 'backend', language: { name: 'java' } };
    },
  },
  {
    files: ['*.csproj', '*.sln'],
    detect: () => ({ stack: 'dotnet', role: 'backend', language: { name: 'csharp' } }),
  },
  {
    files: ['go.mod'],
    detect: () => ({ stack: 'go', role: 'backend', language: { name: 'go' }, unsupported: true }),
  },
  {
    files: ['Cargo.toml'],
    detect: () => ({ stack: 'rust', role: 'backend', language: { name: 'rust' }, unsupported: true }),
  },
  {
    files: ['package.json'],
    detect: (content) => {
      const pkg = JSON.parse(content);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps['next']) return { stack: 'nextjs', role: 'frontend', language: { name: 'typescript' } };
      if (deps['nuxt']) return { stack: 'nuxtjs', role: 'frontend', language: { name: 'typescript' } };
      if (deps['@angular/core']) return { stack: 'angular', role: 'frontend', language: { name: 'typescript' } };
      if (deps['vue']) return { stack: 'vue', role: 'frontend', language: { name: 'typescript' } };
      if (deps['svelte']) return { stack: 'svelte', role: 'frontend', language: { name: 'typescript' } };
      if (deps['react']) return { stack: 'react', role: 'frontend', language: { name: 'typescript' } };
      if (deps['@nestjs/core']) return { stack: 'nestjs', role: 'backend', language: { name: 'typescript' } };
      if (deps['express']) return { stack: 'express', role: 'backend', language: { name: 'javascript' } };
      return null;
    },
  },
];

const IMAGE_TO_INFRA = {
  postgres: 'postgresql', mysql: 'mysql', mariadb: 'mariadb', mongo: 'mongodb',
  redis: 'redis', memcached: 'memcached', rabbitmq: 'rabbitmq',
  elasticsearch: 'elasticsearch', meilisearch: 'meilisearch', minio: 'minio',
};

const INFRA_CATEGORIES = {
  postgresql: 'database', mysql: 'database', mariadb: 'database', mongodb: 'database',
  redis: 'cache', memcached: 'cache',
  rabbitmq: 'queue',
  elasticsearch: 'search', meilisearch: 'search',
  minio: 'storage',
};

export class DetectorService {
  detectFromFiles(fileMap) {
    const services = [];
    let structure = 'monorepo';
    const rootFiles = {};
    const subdirFiles = {};

    for (const [path, content] of Object.entries(fileMap)) {
      const parts = path.split('/');
      if (parts.length === 1) {
        rootFiles[path] = content;
      } else {
        const dir = parts[0];
        if (!subdirFiles[dir]) subdirFiles[dir] = {};
        subdirFiles[dir][parts.slice(1).join('/')] = content;
      }
    }

    const rootResult = this._scanLevel(rootFiles);
    if (rootResult) services.push({ ...rootResult, path: '.' });

    for (const [dir, files] of Object.entries(subdirFiles)) {
      const result = this._scanLevel(files);
      if (result) {
        services.push({ ...result, path: `./${dir}` });
      }
    }

    if (services.length > 1) structure = 'monorepo';

    return { services, structure };
  }

  _scanLevel(files) {
    for (const detector of STACK_DETECTORS) {
      for (const pattern of detector.files) {
        const matchingFile = Object.keys(files).find(f => {
          if (pattern.includes('*')) {
            const suffix = pattern.replace('*', '');
            return f.endsWith(suffix);
          }
          return f === pattern;
        });
        if (matchingFile) {
          const result = detector.detect(files[matchingFile]);
          if (result) return result;
        }
      }
    }
    return null;
  }

  detectInfraFromDockerCompose(composeContent) {
    const infra = { database: null, cache: null, queue: null, search: null, storage: null };
    let parsed;
    try {
      parsed = YAML.parse(composeContent);
    } catch {
      return infra;
    }

    const services = parsed.services || {};
    for (const [, svc] of Object.entries(services)) {
      const image = svc.image || '';
      for (const [prefix, engine] of Object.entries(IMAGE_TO_INFRA)) {
        if (image.startsWith(prefix) || image.includes(`/${prefix}`)) {
          const category = INFRA_CATEGORIES[engine];
          if (category && !infra[category]) {
            const versionMatch = image.match(/:([0-9][0-9.]*)/);
            infra[category] = {
              engine,
              ...(versionMatch ? { version: versionMatch[1] } : {}),
            };
          }
        }
      }
    }

    return infra;
  }
}

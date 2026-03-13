import { existsSync } from 'fs';
import { resolve } from 'path';
import { DockerService } from './docker.service.js';

export class LinkedService {
  resolveLinkedProject(name, linkedConfig, projectRoot) {
    const localPath = resolve(projectRoot, linkedConfig.local_path);
    if (existsSync(localPath)) {
      return { resolvedPath: localPath, source: 'local' };
    }

    const cachePath = resolve(projectRoot, '.devflow/cache/linked', name);
    if (existsSync(cachePath)) {
      return { resolvedPath: cachePath, source: 'cache' };
    }

    return {
      resolvedPath: null,
      source: 'remote',
      repo: linkedConfig.repo,
      branch: linkedConfig.branch || 'main',
    };
  }

  resolveInfrastructureFrom(serviceName, mainConfig) {
    if (!mainConfig.services?.[serviceName] && !mainConfig.infrastructure) {
      return null;
    }
    if (!mainConfig.services?.[serviceName]) {
      return null;
    }
    return mainConfig.infrastructure || null;
  }

  generateWorkspaceCompose(projects) {
    const infraOwner = projects.find(p => p.config.infrastructure && !p.infrastructure_from);

    const mergedConfig = {
      project: { name: 'workspace' },
      services: {},
      infrastructure: infraOwner?.config.infrastructure || {},
    };

    for (const proj of projects) {
      for (const [svcName, svc] of Object.entries(proj.config.services)) {
        mergedConfig.services[svcName] = {
          ...svc,
          path: `${proj.path}/${svc.path === '.' ? '' : svc.path}`.replace(/\/+$/, '') || proj.path,
        };
      }
    }

    const docker = new DockerService();
    return docker.generateCompose(mergedConfig);
  }
}

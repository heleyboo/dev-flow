import { getStackDefaults } from '../maps/stack-map.js';

export class ScaffoldService {
  buildScaffoldCommand(service) {
    const scaffoldConfig = service.scaffold || {};
    const stackDefaults = getStackDefaults(service.stack, service.language?.version);

    const image = scaffoldConfig.docker_image || stackDefaults?.scaffold_image || 'node:20-alpine';
    const scaffoldCmd = (scaffoldConfig.command || stackDefaults?.scaffold || '')
      .replace(/\{path\}/g, '/output')
      .replace(/\{name\}/g, 'app');

    const hostPath = service.path === '.' ? '$(pwd)' : `$(pwd)/${service.path}`;

    return `docker run --rm -v ${hostPath}:/output -w /output ${image} sh -c "${scaffoldCmd}"`;
  }

  buildScaffoldSteps(config) {
    const steps = [];
    const entries = Object.entries(config.services);
    const backends = entries.filter(([, s]) => s.role !== 'frontend');
    const frontends = entries.filter(([, s]) => s.role === 'frontend');

    for (const [name, svc] of [...backends, ...frontends]) {
      steps.push({
        name,
        command: this.buildScaffoldCommand(svc),
        path: svc.path,
        stack: svc.stack,
      });
    }

    return steps;
  }
}

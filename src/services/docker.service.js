import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';
import { getInfraDefaults } from '../maps/infra-map.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = resolve(__dirname, '../docker-templates');

const LANGUAGE_TO_TEMPLATE = {
  php: 'php.Dockerfile',
  python: 'python.Dockerfile',
  javascript: 'node.Dockerfile',
  typescript: 'node.Dockerfile',
  java: 'java.Dockerfile',
  csharp: 'dotnet.Dockerfile',
};

export class DockerService {
  generateCompose(config) {
    const compose = {
      services: {},
      volumes: {},
      networks: { devflow: { driver: 'bridge' } },
    };

    const infraServices = [];

    if (config.infrastructure) {
      for (const [category, infra] of Object.entries(config.infrastructure)) {
        if (!infra || !infra.engine || infra.engine === 'none') continue;

        const defaults = getInfraDefaults(infra.engine, infra.version);
        if (!defaults) continue;

        const serviceName = category;
        const volumeName = `${serviceName}_data`;

        compose.services[serviceName] = {
          image: defaults.image,
          ports: [`${infra.port || defaults.port}:${defaults.port}`],
          environment: { ...defaults.env, ...(defaults.extra_env || {}) },
          volumes: [`${volumeName}:/data`],
          healthcheck: {
            test: ['CMD-SHELL', defaults.healthcheck],
            interval: '10s',
            timeout: '5s',
            retries: 5,
          },
          networks: ['devflow'],
          restart: 'unless-stopped',
        };

        if (defaults.extra_ports) {
          for (const p of defaults.extra_ports) {
            compose.services[serviceName].ports.push(`${p}:${p}`);
          }
        }

        compose.volumes[volumeName] = {};
        infraServices.push(serviceName);

        if (defaults.companions) {
          for (const [compName, comp] of Object.entries(defaults.companions)) {
            compose.services[compName] = {
              image: comp.image,
              ports: [`${comp.port}:${comp.port}`],
              environment: comp.env || {},
              healthcheck: {
                test: ['CMD-SHELL', comp.healthcheck],
                interval: '10s',
                timeout: '5s',
                retries: 5,
              },
              networks: ['devflow'],
              restart: 'unless-stopped',
            };
          }
        }
      }
    }

    for (const [name, svc] of Object.entries(config.services)) {
      const buildContext = svc.path === '.' ? '.' : svc.path;

      compose.services[name] = {
        build: { context: buildContext, dockerfile: 'Dockerfile' },
        ports: [`${svc.port}:${svc.port}`],
        volumes: [
          `${buildContext === '.' ? '.' : buildContext}:/app`,
          `${name}_deps:/app/node_modules`,
        ],
        environment: { NODE_ENV: 'development' },
        depends_on: {},
        networks: ['devflow'],
        restart: 'unless-stopped',
      };

      for (const infraName of infraServices) {
        compose.services[name].depends_on[infraName] = { condition: 'service_healthy' };
      }

      compose.volumes[`${name}_deps`] = {};
    }

    return YAML.stringify(compose, { lineWidth: 120 });
  }

  generateDockerfile(service) {
    const templateFile = LANGUAGE_TO_TEMPLATE[service.language.name];
    if (!templateFile) return null;

    let template;
    try {
      template = readFileSync(resolve(TEMPLATES_DIR, templateFile), 'utf-8');
    } catch {
      return null;
    }

    return template
      .replace(/\{\{version\}\}/g, service.language.version)
      .replace(/\{\{port\}\}/g, String(service.port))
      .replace(/\{\{entry_point\}\}/g, service.entry_point || '');
  }
}

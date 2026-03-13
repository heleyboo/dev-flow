export function computePortOffset(projectName) {
  let hash = 0;
  for (let i = 0; i < projectName.length; i++) {
    hash = ((hash << 5) - hash + projectName.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 200;
}

export function resolvePort({ explicitPort, basePort, offset }) {
  if (explicitPort != null) return explicitPort;
  return basePort + offset;
}

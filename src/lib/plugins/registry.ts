import { Plugin } from './types';

export const pluginRegistry: Plugin[] = [
  {
    id: 'code-review-graph',
    name: 'Code Review Graph',
    description:
      'Visualizes code review patterns, PR flows, and reviewer ownership as an interactive knowledge graph. Identifies bottlenecks, tracks review velocity, and surfaces code ownership relationships.',
    version: '1.0.0',
    category: 'code-analysis',
    status: 'installed',
    author: { name: 'tirth8205', github: 'tirth8205' },
    tags: ['code-review', 'graph', 'visualization', 'pr-analysis', 'knowledge-graph'],
    dependencies: [],
    integrations: ['GitHub', 'GitLab', 'Bitbucket'],
    installCommand: 'claude plugin install code-review-graph@code-review-graph',
    stars: 128,
    downloads: 1240,
    graphNodes: [
      { id: 'pr', label: 'Pull Requests', type: 'entity' },
      { id: 'reviewer', label: 'Reviewers', type: 'entity' },
      { id: 'file', label: 'Files', type: 'entity' },
      { id: 'ownership', label: 'Ownership Map', type: 'concept' },
      { id: 'velocity', label: 'Review Velocity', type: 'concept' },
      { id: 'bottleneck', label: 'Bottleneck Detection', type: 'process' },
    ],
    graphEdges: [
      { source: 'pr', target: 'reviewer', label: 'assigned-to' },
      { source: 'pr', target: 'file', label: 'touches' },
      { source: 'file', target: 'ownership', label: 'maps-to' },
      { source: 'reviewer', target: 'velocity', label: 'contributes-to' },
      { source: 'velocity', target: 'bottleneck', label: 'detects' },
    ],
  },
  {
    id: 'gke-insight',
    name: 'GKE Insight',
    description:
      'Deep GKE cluster intelligence — pod dependency graphs, resource utilization heatmaps, and automated remediation suggestions.',
    version: '2.1.0',
    category: 'monitoring',
    status: 'installed',
    author: { name: 'cloud-tools', github: 'cloud-tools' },
    tags: ['gke', 'kubernetes', 'monitoring', 'pods'],
    dependencies: [],
    integrations: ['Google Cloud', 'Prometheus', 'Grafana'],
    installCommand: 'claude plugin install gke-insight@cloud-tools',
    stars: 342,
    downloads: 5800,
  },
  {
    id: 'security-posture',
    name: 'Security Posture',
    description:
      'Continuous cloud security posture management. Detects misconfigurations, maps IAM privilege escalation paths, and generates CIS benchmark reports.',
    version: '1.4.2',
    category: 'security',
    status: 'available',
    author: { name: 'secops-team', github: 'secops-team' },
    tags: ['security', 'iam', 'compliance', 'cis', 'cspm'],
    dependencies: [],
    integrations: ['AWS', 'GCP', 'Azure'],
    installCommand: 'claude plugin install security-posture@secops-team',
    stars: 519,
    downloads: 9120,
  },
  {
    id: 'pipeline-graph',
    name: 'Pipeline Graph',
    description:
      'Maps CI/CD pipeline dependencies as a directed acyclic graph. Highlights critical paths, identifies slow stages, and suggests parallelization opportunities.',
    version: '0.9.1',
    category: 'ci-cd',
    status: 'beta',
    author: { name: 'devflow', github: 'devflow-io' },
    tags: ['ci-cd', 'pipeline', 'dag', 'optimization'],
    dependencies: [{ id: 'code-review-graph', version: '^1.0.0' }],
    integrations: ['GitHub Actions', 'CircleCI', 'Jenkins', 'ArgoCD'],
    installCommand: 'claude plugin install pipeline-graph@devflow',
    stars: 87,
    downloads: 670,
  },
  {
    id: 'cost-anomaly',
    name: 'Cost Anomaly Detector',
    description:
      'ML-powered cloud spend anomaly detection. Correlates cost spikes with deployments, auto-generates cost attribution reports, and triggers budget alerts.',
    version: '1.2.0',
    category: 'monitoring',
    status: 'available',
    author: { name: 'finops-labs', github: 'finops-labs' },
    tags: ['cost', 'finops', 'anomaly', 'ml'],
    dependencies: [],
    integrations: ['AWS Cost Explorer', 'GCP Billing', 'Datadog'],
    installCommand: 'claude plugin install cost-anomaly@finops-labs',
    stars: 203,
    downloads: 3200,
  },
  {
    id: 'infra-drift',
    name: 'Infra Drift Detector',
    description:
      'Compares live infrastructure state against Terraform plans, detects configuration drift, and generates reconciliation pull requests automatically.',
    version: '1.0.3',
    category: 'automation',
    status: 'available',
    author: { name: 'iac-tools', github: 'iac-tools' },
    tags: ['terraform', 'drift', 'iac', 'automation'],
    dependencies: [],
    integrations: ['Terraform', 'Pulumi', 'GitHub'],
    installCommand: 'claude plugin install infra-drift@iac-tools',
    stars: 156,
    downloads: 2100,
  },
  {
    id: 'log-intelligence',
    name: 'Log Intelligence',
    description:
      'Semantic log clustering and anomaly detection. Groups related error patterns, surfaces root causes, and integrates with PagerDuty for intelligent alerting.',
    version: '2.0.0',
    category: 'monitoring',
    status: 'available',
    author: { name: 'observability-co', github: 'observability-co' },
    tags: ['logs', 'observability', 'clustering', 'ai'],
    dependencies: [],
    integrations: ['CloudWatch', 'Splunk', 'PagerDuty', 'Datadog'],
    installCommand: 'claude plugin install log-intelligence@observability-co',
    stars: 441,
    downloads: 7800,
  },
];

export const getCategoryColor = (category: Plugin['category']): string => {
  const colors: Record<Plugin['category'], string> = {
    'code-analysis': '#6366f1',
    monitoring: '#06b6d4',
    security: '#ef4444',
    'ci-cd': '#f59e0b',
    automation: '#10b981',
    visualization: '#8b5cf6',
  };
  return colors[category];
};

export const getStatusBadge = (status: Plugin['status']) => {
  const badges: Record<Plugin['status'], { label: string; className: string }> = {
    installed: { label: 'Installed', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
    available: { label: 'Available', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    beta: { label: 'Beta', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    deprecated: { label: 'Deprecated', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
  };
  return badges[status];
};

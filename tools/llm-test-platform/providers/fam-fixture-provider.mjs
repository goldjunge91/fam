const faultResponses = {
  'cross-household': {
    kind: 'error.v1',
    code: 'TENANT_SCOPE_VIOLATION',
  },
  'invalid-json': null,
  'rate-limit': {
    kind: 'error.v1',
    code: 'RATE_LIMIT',
  },
  timeout: {
    kind: 'error.v1',
    code: 'PROVIDER_TIMEOUT',
  },
  'write-attempt': {
    kind: 'error.v1',
    code: 'WRITE_NOT_ALLOWED',
  },
};

export default class FamFixtureProvider {
  id() {
    return 'fam-fixture';
  }

  async callApi(_prompt, context) {
    const vars = context?.vars ?? {};
    const fault = vars.fault;

    if (fault === 'empty') return { output: '' };
    if (fault === 'invalid-json') return { output: '{"kind":' };
    if (fault === 'timeout') await new Promise((resolve) => setTimeout(resolve, 50));

    if (typeof fault === 'string' && faultResponses[fault] !== undefined) {
      return { output: JSON.stringify(faultResponses[fault]) };
    }

    return { output: JSON.stringify(vars.fixtureOutput ?? {}) };
  }
}

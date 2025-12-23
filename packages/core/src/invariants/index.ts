/**
 * Invariant Checks (v0.0.8)
 *
 * 🧀 Cognitive: state×async×retry 공존 탐지
 * 🍞 Security: Secret 패턴 탐지, 금지 영역 경고
 */

import type { AsyncComplexity, StateComplexity } from '../types.js';

// ─────────────────────────────────────────────────────────────────
// 🧀 Cognitive Invariant: state×async×retry 공존 금지
// ─────────────────────────────────────────────────────────────────

export interface CognitiveViolation {
  hasState: boolean;
  hasAsync: boolean;
  hasRetry: boolean;
  violation: boolean;
  message: string;
}

/**
 * state×async×retry 공존 여부 검사
 *
 * 이 세 가지가 동일 함수에 공존하면 인지 붕괴 위험
 */
export function checkCognitiveInvariant(
  state: StateComplexity,
  async: AsyncComplexity
): CognitiveViolation {
  const hasState = state.stateMutations > 0 || state.stateMachinePatterns.length > 0;
  const hasAsync = async.asyncBoundaries > 0 || async.promiseChains > 0;
  const hasRetry = async.retryPatterns > 0;

  // 세 가지 모두 존재하면 위반
  const violation = hasState && hasAsync && hasRetry;

  // 두 가지만 있어도 경고
  const count = [hasState, hasAsync, hasRetry].filter(Boolean).length;

  let message = '';
  if (violation) {
    message = '🧀 VIOLATION: state×async×retry 공존. 함수 분리 필수.';
  } else if (count === 2) {
    message = '🧀 WARNING: 2개 축 공존. 복잡도 주의.';
  }

  return { hasState, hasAsync, hasRetry, violation, message };
}

// ─────────────────────────────────────────────────────────────────
// 🍞 Security: Secret 패턴 탐지
// ─────────────────────────────────────────────────────────────────

export interface SecretViolation {
  pattern: string;
  match: string;
  line: number;
  severity: 'warning' | 'error';
  message: string;
}

const SECRET_PATTERNS: Array<{ regex: RegExp; name: string; severity: 'warning' | 'error' }> = [
  // API Keys
  { regex: /['"`](?:api[_-]?key|apikey)['"`]\s*[=:]\s*['"`][^'"`]{10,}['"`]/gi, name: 'API_KEY', severity: 'error' },
  { regex: /['"`](?:secret|password|passwd|pwd)['"`]\s*[=:]\s*['"`][^'"`]{6,}['"`]/gi, name: 'SECRET', severity: 'error' },

  // Bearer tokens
  { regex: /Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g, name: 'BEARER_TOKEN', severity: 'error' },

  // AWS
  { regex: /AKIA[0-9A-Z]{16}/g, name: 'AWS_ACCESS_KEY', severity: 'error' },
  { regex: /aws[_-]?secret[_-]?access[_-]?key/gi, name: 'AWS_SECRET_KEY', severity: 'error' },

  // Private keys
  { regex: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g, name: 'PRIVATE_KEY', severity: 'error' },

  // Connection strings
  { regex: /(?:mongodb|postgres|mysql|redis):\/\/[^@]+:[^@]+@/gi, name: 'DB_CONNECTION_STRING', severity: 'error' },

  // process.env 직접 사용 (경고)
  { regex: /process\.env\.[A-Z_]+/g, name: 'ENV_ACCESS', severity: 'warning' },
];

/**
 * 코드에서 Secret 패턴 탐지
 */
export function detectSecrets(code: string): SecretViolation[] {
  const violations: SecretViolation[] = [];

  for (const { regex, name, severity } of SECRET_PATTERNS) {
    // Reset regex state
    regex.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(code)) !== null) {
      // Find line number
      const beforeMatch = code.substring(0, match.index);
      const line = beforeMatch.split('\n').length;

      // Mask the actual secret
      const masked = match[0].length > 20
        ? match[0].substring(0, 10) + '...' + match[0].substring(match[0].length - 5)
        : match[0];

      violations.push({
        pattern: name,
        match: masked,
        line,
        severity,
        message: severity === 'error'
          ? `🍞 ERROR: ${name} detected at line ${line}. Remove before commit.`
          : `🍞 WARNING: ${name} at line ${line}. Consider using secrets manager.`,
      });
    }
  }

  return violations;
}

// ─────────────────────────────────────────────────────────────────
// 🍞 Security: LLM 금지 영역 탐지
// ─────────────────────────────────────────────────────────────────

export interface LockedZoneWarning {
  zone: string;
  matched: string;
  message: string;
}

const LOCKED_ZONE_PATTERNS: Array<{ regex: RegExp; zone: string }> = [
  // Auth/Authz
  { regex: /\bauth(?:entication|orization|enticate|orize)?\b/i, zone: 'auth' },
  { regex: /\blogin\b|\blogout\b|\bsignin\b|\bsignout\b/i, zone: 'auth' },
  { regex: /\brbac\b|\bacl\b|\bpermission/i, zone: 'auth' },

  // Crypto
  { regex: /\bcrypto\b|\bencrypt\b|\bdecrypt\b|\bhash\b/i, zone: 'crypto' },
  { regex: /\bsign(?:ature)?\b|\bverify\b/i, zone: 'crypto' },
  { regex: /\bcipher\b|\baes\b|\brsa\b/i, zone: 'crypto' },

  // Patient/Medical data (HIPAA)
  { regex: /\bpatient\b|\bmedical\b|\bhealth\b/i, zone: 'patient-data' },
  { regex: /\bphi\b|\bhipaa\b/i, zone: 'patient-data' },

  // Deployment/Infrastructure
  { regex: /\bdeploy\b|\binfra(?:structure)?\b/i, zone: 'deploy' },
  { regex: /\bkubernetes\b|\bk8s\b|\bhelm\b/i, zone: 'deploy' },
  { regex: /\btls\b|\bssl\b|\bcert(?:ificate)?\b/i, zone: 'deploy' },
  { regex: /\bnetwork\s?policy\b/i, zone: 'deploy' },
];

/**
 * 파일/함수가 LLM 금지 영역인지 검사
 */
export function checkLockedZone(
  filePath: string,
  functionName?: string
): LockedZoneWarning | null {
  const target = `${filePath} ${functionName || ''}`;

  for (const { regex, zone } of LOCKED_ZONE_PATTERNS) {
    const match = target.match(regex);
    if (match) {
      return {
        zone,
        matched: match[0],
        message: `⚠️ LOCKED ZONE: ${zone}. LLM 수정 금지. 인간 승인 필요.`,
      };
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────
// 종합 검사
// ─────────────────────────────────────────────────────────────────

export interface InvariantCheckResult {
  cognitive: CognitiveViolation;
  secrets: SecretViolation[];
  lockedZone: LockedZoneWarning | null;
  passed: boolean;
  summary: string;
}

/**
 * 모든 불변조건 검사 수행
 */
export function checkAllInvariants(
  code: string,
  filePath: string,
  functionName: string | undefined,
  state: StateComplexity,
  async: AsyncComplexity
): InvariantCheckResult {
  const cognitive = checkCognitiveInvariant(state, async);
  const secrets = detectSecrets(code);
  const lockedZone = checkLockedZone(filePath, functionName);

  const hasError =
    cognitive.violation ||
    secrets.some((s) => s.severity === 'error') ||
    lockedZone !== null;

  const passed = !hasError;

  const issues: string[] = [];
  if (cognitive.violation) issues.push('🧀 Cognitive violation');
  if (secrets.length > 0) issues.push(`🍞 ${secrets.length} secret(s)`);
  if (lockedZone) issues.push(`⚠️ Locked zone: ${lockedZone.zone}`);

  const summary = passed
    ? '✅ All invariants passed'
    : `❌ Issues: ${issues.join(', ')}`;

  return { cognitive, secrets, lockedZone, passed, summary };
}

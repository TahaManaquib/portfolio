/**
 * A small role-based access control engine.
 *
 * No DOM in here on purpose: it is a plain function over plain data, which
 * keeps it readable on its own and testable under bare `node`. That is also
 * where the engineering credibility of this section lives — an engineer reading
 * the repo will open this file, not the component.
 *
 * The model is the textbook one, flaws included, because the flaws are the
 * interesting part: an explicit deny outranks any grant, a grant can carry a
 * condition evaluated per-resource, and anything not granted is denied. Those
 * three rules are enough to produce every surprise this section is built on.
 */

export const ROLES = [
  { id: 'owner', label: 'owner' },
  { id: 'admin', label: 'admin' },
  { id: 'member', label: 'member' },
  { id: 'billing', label: 'billing' },
  /** Starts with nothing. The scenarios below are built on it. */
  { id: 'contractor', label: 'contractor' },
] as const;

export type RoleId = (typeof ROLES)[number]['id'];

export const DEFAULT_ROLE: RoleId = 'admin';

/** A thing that can be acted on. `mine` is what ownership conditions test. */
export interface Resource {
  readonly id: string;
  readonly label: string;
  /** Which actions apply to it. Nothing lets you pay a project. */
  readonly kind: string;
  /** Who created it, for the explanation. `null` when nobody in particular did. */
  readonly createdBy: string | null;
  readonly mine: boolean;
}

export const RESOURCES: Record<string, Resource> = {
  apollo: { id: 'apollo', label: 'Apollo', kind: 'project', createdBy: 'you', mine: true },
  zephyr: { id: 'zephyr', label: 'Zephyr', kind: 'project', createdBy: 'Dana', mine: false },
  invoice: { id: 'invoice', label: 'Invoice #1041', kind: 'invoice', createdBy: null, mine: false },
  people: { id: 'people', label: 'People', kind: 'people', createdBy: null, mine: false },
  key: { id: 'key', label: 'Deploy key', kind: 'apikey', createdBy: null, mine: false },
};

/** Dropdown order for the composer. */
export const RESOURCE_ORDER = ['apollo', 'zephyr', 'invoice', 'people', 'key'] as const;

/**
 * Every action the model knows, not only the ones the summary lists.
 *
 * The gap between the two is deliberate. A composer that can only re-ask the
 * questions already on screen is a second way to read the same thing, which is
 * exactly the failure the terminal was criticised for. These are the answers you
 * can only get by asking.
 */
export interface ActionDef {
  readonly id: string;
  readonly kind: string;
  readonly label: string;
}

export const ACTIONS: readonly ActionDef[] = [
  { id: 'project:view', kind: 'project', label: 'view' },
  { id: 'project:edit', kind: 'project', label: 'edit' },
  { id: 'project:delete', kind: 'project', label: 'delete' },
  { id: 'project:transfer', kind: 'project', label: 'transfer' },
  { id: 'invoice:view', kind: 'invoice', label: 'view' },
  { id: 'invoice:pay', kind: 'invoice', label: 'pay' },
  { id: 'invoice:refund', kind: 'invoice', label: 'refund' },
  { id: 'people:view', kind: 'people', label: 'view' },
  { id: 'people:invite', kind: 'people', label: 'invite someone' },
  { id: 'people:remove', kind: 'people', label: 'remove someone' },
  { id: 'people:role', kind: 'people', label: "change someone's role" },
  { id: 'apikey:view', kind: 'apikey', label: 'view' },
  { id: 'apikey:create', kind: 'apikey', label: 'create' },
  { id: 'apikey:revoke', kind: 'apikey', label: 'revoke' },
];

export const actionsFor = (kind: string) => ACTIONS.filter((a) => a.kind === kind);
export const actionLabel = (id: string) => ACTIONS.find((a) => a.id === id)?.label ?? id;

/** What each kind is called when an action has to name its own subject. */
const KIND_NOUN: Record<string, string> = {
  project: 'projects',
  invoice: 'the invoice',
  people: 'people',
  apikey: 'deploy keys',
};

/**
 * `view deploy keys` rather than `view`.
 *
 * The bare verb is fine inside its group, where the heading supplies the
 * subject. Listed on its own — in the over-granting note, say — it is ambiguous
 * and has to carry what it applies to.
 */
export function actionFullLabel(id: string): string {
  const action = ACTIONS.find((a) => a.id === id);
  if (!action) return id;
  return `${action.label} ${KIND_NOUN[action.kind] ?? action.kind}`;
}

/** What the composer starts on. */
export const DEFAULT_ASK = { action: 'project:transfer', resource: 'apollo' } as const;

/**
 * Grants and denials. `*` matches anything, `project:*` any project action.
 *
 * Read down the `admin` block and notice what is missing: paying. Most people
 * assume roles are a ladder — owner above admin above member — and `billing`
 * being able to do something `admin` cannot is the first thing this section
 * teaches, without a word of explanation.
 */
export interface Rule {
  readonly role: RoleId;
  readonly action: string;
  readonly effect: 'allow' | 'deny';
  /** Grants only what the viewer created. */
  readonly when?: 'mine';
}

export const POLICY: readonly Rule[] = [
  { role: 'owner', action: '*', effect: 'allow' },

  { role: 'admin', action: 'project:*', effect: 'allow' },
  /**
   * The wildcard above would have covered this. Handing a project to someone
   * else is an ownership change, not project management, so it is carved back
   * out — and because a deny outranks any grant, the carve-out holds no matter
   * what else is granted. It is the one place the default policy demonstrates
   * that rule, and it is reachable only by asking, never by reading the summary.
   */
  { role: 'admin', action: 'project:transfer', effect: 'deny' },
  { role: 'admin', action: 'apikey:*', effect: 'allow' },
  { role: 'admin', action: 'invoice:view', effect: 'allow' },
  { role: 'admin', action: 'people:view', effect: 'allow' },
  { role: 'admin', action: 'people:invite', effect: 'allow' },

  { role: 'member', action: 'project:view', effect: 'allow' },
  { role: 'member', action: 'project:edit', effect: 'allow', when: 'mine' },
  { role: 'member', action: 'project:delete', effect: 'allow', when: 'mine' },
  { role: 'member', action: 'people:view', effect: 'allow' },

  { role: 'billing', action: 'invoice:*', effect: 'allow' },
];

function matches(pattern: string, action: string): boolean {
  if (pattern === '*') return true;
  if (pattern.endsWith(':*')) return action.startsWith(`${pattern.slice(0, -1)}`);
  return pattern === action;
}

export interface Decision {
  readonly allowed: boolean;
  /**
   * Why, in words that need no background. Empty when a plain grant covers it —
   * "allowed because a rule says so" is not worth a line of the visitor's time.
   */
  readonly reason: string;
  /** The name an engineer would use for that reason. Rendered as a dim tag. */
  readonly term: string;
  /** The evaluation itself, for anyone who wants to see the working. */
  readonly trace: readonly string[];
}

/**
 * Resolves one question: may this role do this thing to this resource?
 *
 * Order matters and is the whole model. Explicit denials are collected first
 * and win outright — that is what makes a deny impossible to grant your way
 * around. Then grants are tried in turn, and a grant carrying a condition only
 * counts if the condition holds for *this* resource. Anything left over is
 * denied, because nothing said otherwise.
 */
export function evaluate(
  role: RoleId,
  action: string,
  resource: Resource,
  policy: readonly Rule[] = POLICY,
): Decision {
  const relevant = policy.filter((r) => r.role === role && matches(r.action, action));

  const denial = relevant.find((r) => r.effect === 'deny');
  if (denial) {
    return {
      allowed: false,
      reason: 'a rule blocks this outright, and blocking always wins',
      term: 'deny overrides allow',
      trace: [`${role} · ${action}`, `deny ${denial.action}`, '→ denied'],
    };
  }

  const grants = relevant.filter((r) => r.effect === 'allow');
  if (grants.length === 0) {
    return {
      allowed: false,
      reason: `nothing gives ${role} this`,
      term: 'denied by default',
      trace: [`${role} · ${action}`, 'no matching rule', '→ denied'],
    };
  }

  const unconditional = grants.find((r) => r.when === undefined);
  if (unconditional) {
    return {
      allowed: true,
      reason: '',
      term: 'role grant',
      trace: [`${role} · ${action}`, `allow ${unconditional.action}`, '→ allowed'],
    };
  }

  // Every grant that could apply carries a condition, so the resource decides.
  const conditional = grants[0] as Rule;
  if (resource.mine) {
    return {
      allowed: true,
      reason: 'you created this one',
      term: 'ownership condition',
      trace: [
        `${role} · ${action}`,
        `allow ${conditional.action} — only what you created`,
        `${resource.label} was created by you`,
        '→ allowed',
      ],
    };
  }
  return {
    allowed: false,
    reason: `only for things you created — ${resource.label} is ${resource.createdBy ?? 'someone else'}'s`,
    term: 'ownership condition',
    trace: [
      `${role} · ${action}`,
      `allow ${conditional.action} — only what you created`,
      `${resource.label} was created by ${resource.createdBy ?? 'someone else'}`,
      '→ denied',
    ],
  };
}

/**
 * The questions the section asks, in the order it asks them.
 *
 * A curated list rather than every action against every resource: a full grid
 * would be four times the size and say less. Zephyr deliberately omits `view` —
 * it answers identically to Apollo's, and a row that always agrees with the one
 * above it is a row that teaches nothing.
 */
export interface Check {
  readonly action: string;
  readonly resource: string;
}

export interface Group {
  readonly label: string;
  readonly note: string;
  readonly checks: readonly Check[];
}

export const GROUPS: readonly Group[] = [
  {
    label: 'Apollo',
    note: 'a project you created',
    checks: [
      { action: 'project:edit', resource: 'apollo' },
      { action: 'project:delete', resource: 'apollo' },
    ],
  },
  {
    label: 'Zephyr',
    note: 'a project Dana created',
    checks: [
      { action: 'project:edit', resource: 'zephyr' },
      { action: 'project:delete', resource: 'zephyr' },
    ],
  },
  {
    label: 'Invoice #1041',
    note: 'unpaid',
    checks: [{ action: 'invoice:pay', resource: 'invoice' }],
  },
  {
    label: 'People',
    note: 'three teammates',
    checks: [
      { action: 'people:invite', resource: 'people' },
      { action: 'people:role', resource: 'people' },
    ],
  },
];

/**
 * Changes the visitor can make to the policy.
 *
 * Toggles rather than a rule builder: a fixed set of plausible edits keeps every
 * reachable state understandable, and there is no invalid policy to design for.
 * Each one is chosen because it teaches something the default policy cannot.
 */
export interface Toggle {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly rules: readonly Rule[];
}

export const TOGGLES: readonly Toggle[] = [
  {
    id: 'admin-roles',
    label: 'admins change roles',
    detail: 'lets an admin set anyone’s role, including their own',
    rules: [{ role: 'admin', action: 'people:role', effect: 'allow' }],
  },
  {
    id: 'member-delete',
    label: 'members delete anything',
    detail: 'drops the "only what you created" condition for members',
    rules: [{ role: 'member', action: 'project:delete', effect: 'allow' }],
  },
  {
    id: 'freeze-deletes',
    label: 'nobody deletes projects',
    detail: 'a blanket block, applied to every role including the owner',
    rules: ROLES.map((r) => ({ role: r.id, action: 'project:delete', effect: 'deny' as const })),
  },
];

/** The policy as the visitor currently has it. */
export function withToggles(enabled: readonly string[]): readonly Rule[] {
  const extra = TOGGLES.filter((t) => enabled.includes(t.id)).flatMap((t) => t.rules);
  return [...POLICY, ...extra];
}

/**
 * Actions that let whoever holds them rewrite the policy itself.
 *
 * This list is the whole basis of the analysis below, and keeping it explicit is
 * what stops that analysis being a string comparison dressed up as a finding.
 * Only `people:role` qualifies in this model: nothing else here lets an actor
 * change what an actor may do.
 */
export const POLICY_CHANGING = ['people:role'] as const;

/** Whether a role can perform an action against *any* resource it applies to. */
function reachable(role: RoleId, action: string, policy: readonly Rule[]): boolean {
  const kind = ACTIONS.find((a) => a.id === action)?.kind;
  return RESOURCE_ORDER.some((id) => {
    const resource = RESOURCES[id];
    if (!resource || resource.kind !== kind) return false;
    return evaluate(role, action, resource, policy).allowed;
  });
}

export interface Escalation {
  readonly role: RoleId;
  readonly via: string;
  /** Actions the role was never granted but could take after elevating. */
  readonly gains: readonly string[];
}

/**
 * Finds roles that can promote themselves.
 *
 * The reasoning is short and worth stating: a role able to change roles can
 * assign itself any role, so its real reach is the union of every role's
 * permissions — not the ones its own rules list. Anything in that union it
 * cannot currently do is a permission it was never granted and can take anyway.
 *
 * Derived from the policy in force, so it stays true as the policy changes
 * rather than being a note about one particular toggle. The owner is skipped
 * because it has nothing to escalate to.
 */
export function escalations(policy: readonly Rule[] = POLICY): readonly Escalation[] {
  const found: Escalation[] = [];
  for (const { id: role } of ROLES) {
    if (role === 'owner') continue;
    for (const via of POLICY_CHANGING) {
      if (!reachable(role, via, policy)) continue;
      const gains = ACTIONS.map((a) => a.id).filter(
        (action) =>
          !reachable(role, action, policy) &&
          ROLES.some((other) => reachable(other.id, action, policy)),
      );
      if (gains.length > 0) found.push({ role, via, gains });
    }
  }
  return found;
}

/**
 * The scenarios — the part that asks the visitor to produce something rather
 * than read something.
 *
 * Three different *shapes* of task, not three difficulties, and deliberately
 * unordered: a numbered list you work through is a curriculum, which is exactly
 * what sank the section this replaced. Pick any, in any order, none locked.
 */
export interface ActionRequirement {
  readonly type: 'action';
  /** true = must be able to, false = must not be able to. */
  readonly must: boolean;
  readonly action: string;
  readonly resource: string;
  readonly label: string;
}

export interface EscalationRequirement {
  readonly type: 'escalation';
  readonly must: false;
  readonly label: string;
}

export type Requirement = ActionRequirement | EscalationRequirement;

/**
 * How hard the visitor has asked for it to be.
 *
 * Three demands stacked rather than three tiers of content: correctness, then
 * precision, then judgement. Nothing is locked — a level is chosen, never
 * earned. The moment it gates, this is a curriculum again, which is what sank
 * the section it replaced.
 */
export const LEVELS = [
  { id: 'stated', label: 'stated', demand: 'meet the brief' },
  { id: 'minimal', label: 'minimal', demand: 'and grant nothing beyond it' },
  { id: 'judgement', label: 'judgement', demand: 'and work out the limits yourself' },
] as const;

export type LevelId = (typeof LEVELS)[number]['id'];

export const DEFAULT_LEVEL: LevelId = 'stated';

export interface Scenario {
  readonly id: string;
  readonly level: LevelId;
  readonly title: string;
  readonly brief: string;
  /** The role the visitor is configuring. */
  readonly role: RoleId;
  /**
   * `build` starts from nothing and is graded on least privilege. `fix` starts
   * from the policy as shipped, where "extra" has no meaning — the role already
   * holds permissions the brief never mentions, and flagging them would be
   * noise rather than a finding.
   */
  readonly mode: 'build' | 'fix';
  readonly requirements: readonly Requirement[];
}

export const SCENARIOS: readonly Scenario[] = [
  // ---- stated: meet the brief --------------------------------------------
  {
    id: 'contractor',
    level: 'stated',
    title: 'the contractor',
    brief: 'Priya is joining for six weeks to work on Apollo.',
    role: 'contractor',
    mode: 'build',
    requirements: [
      {
        type: 'action',
        must: true,
        action: 'project:view',
        resource: 'apollo',
        label: 'open a project',
      },
      {
        type: 'action',
        must: true,
        action: 'project:edit',
        resource: 'apollo',
        label: 'edit a project',
      },
      {
        type: 'action',
        must: false,
        action: 'project:delete',
        resource: 'apollo',
        label: 'delete a project',
      },
      {
        type: 'action',
        must: false,
        action: 'invoice:view',
        resource: 'invoice',
        label: 'see the invoice',
      },
    ],
  },
  {
    id: 'bookkeeper',
    level: 'stated',
    title: 'the bookkeeper',
    brief: 'Sam handles the money, and nothing else.',
    role: 'contractor',
    mode: 'build',
    requirements: [
      {
        type: 'action',
        must: true,
        action: 'invoice:view',
        resource: 'invoice',
        label: 'see the invoice',
      },
      { type: 'action', must: true, action: 'invoice:pay', resource: 'invoice', label: 'pay it' },
      {
        type: 'action',
        must: false,
        action: 'project:view',
        resource: 'apollo',
        label: 'open a project',
      },
      {
        type: 'action',
        must: false,
        action: 'people:view',
        resource: 'people',
        label: 'see who is here',
      },
    ],
  },
  {
    id: 'auditor',
    level: 'stated',
    title: 'the auditor',
    brief: 'An external auditor needs to see how the place runs. They must not change anything.',
    role: 'contractor',
    mode: 'build',
    requirements: [
      {
        type: 'action',
        must: true,
        action: 'project:view',
        resource: 'apollo',
        label: 'open a project',
      },
      {
        type: 'action',
        must: true,
        action: 'invoice:view',
        resource: 'invoice',
        label: 'see the invoice',
      },
      {
        type: 'action',
        must: true,
        action: 'people:view',
        resource: 'people',
        label: 'see who is here',
      },
      {
        type: 'action',
        must: false,
        action: 'project:edit',
        resource: 'apollo',
        label: 'edit a project',
      },
      {
        type: 'action',
        must: false,
        action: 'invoice:pay',
        resource: 'invoice',
        label: 'pay the invoice',
      },
      {
        type: 'action',
        must: false,
        action: 'people:invite',
        resource: 'people',
        label: 'invite someone',
      },
    ],
  },

  // ---- minimal: and grant nothing beyond it ------------------------------
  {
    id: 'bot',
    level: 'minimal',
    title: 'the deploy bot',
    brief: 'A CI service account rotates deploy keys on a schedule. It is not a person.',
    role: 'contractor',
    mode: 'build',
    requirements: [
      { type: 'action', must: true, action: 'apikey:view', resource: 'key', label: 'see a key' },
      {
        type: 'action',
        must: true,
        action: 'apikey:create',
        resource: 'key',
        label: 'create a key',
      },
      {
        type: 'action',
        must: true,
        action: 'apikey:revoke',
        resource: 'key',
        label: 'revoke a key',
      },
      {
        type: 'action',
        must: false,
        action: 'people:view',
        resource: 'people',
        label: 'see who is here',
      },
    ],
  },
  {
    id: 'approver',
    level: 'minimal',
    title: 'the approver',
    brief: 'Jo approves payments. Refunds go through the owner.',
    role: 'contractor',
    mode: 'build',
    requirements: [
      {
        type: 'action',
        must: true,
        action: 'invoice:view',
        resource: 'invoice',
        label: 'see the invoice',
      },
      { type: 'action', must: true, action: 'invoice:pay', resource: 'invoice', label: 'pay it' },
      {
        type: 'action',
        must: false,
        action: 'invoice:refund',
        resource: 'invoice',
        label: 'refund it',
      },
    ],
  },
  {
    id: 'leak',
    level: 'minimal',
    title: 'after the leak',
    brief:
      'A deploy key was posted in a public channel. Lock keys down without stopping anyone working.',
    role: 'admin',
    mode: 'fix',
    requirements: [
      {
        type: 'action',
        must: true,
        action: 'project:edit',
        resource: 'apollo',
        label: 'edit a project',
      },
      {
        type: 'action',
        must: true,
        action: 'project:delete',
        resource: 'apollo',
        label: 'delete a project',
      },
      {
        type: 'action',
        must: true,
        action: 'invoice:view',
        resource: 'invoice',
        label: 'see the invoice',
      },
      {
        type: 'action',
        must: true,
        action: 'people:invite',
        resource: 'people',
        label: 'invite someone',
      },
      { type: 'action', must: false, action: 'apikey:view', resource: 'key', label: 'see a key' },
      {
        type: 'action',
        must: false,
        action: 'apikey:create',
        resource: 'key',
        label: 'create a key',
      },
      {
        type: 'action',
        must: false,
        action: 'apikey:revoke',
        resource: 'key',
        label: 'revoke a key',
      },
    ],
  },

  // ---- judgement: and work out the limits yourself -----------------------
  {
    id: 'ownership',
    level: 'judgement',
    title: 'whose project is it',
    brief: 'Priya looks after her own work. Apollo is hers; Zephyr belongs to Dana.',
    role: 'contractor',
    mode: 'build',
    requirements: [
      {
        type: 'action',
        must: true,
        action: 'project:view',
        resource: 'apollo',
        label: 'open her own project',
      },
      {
        type: 'action',
        must: true,
        action: 'project:edit',
        resource: 'apollo',
        label: 'edit her own project',
      },
      {
        type: 'action',
        must: false,
        action: 'project:edit',
        resource: 'zephyr',
        label: "edit Dana's project",
      },
      {
        type: 'action',
        must: false,
        action: 'project:delete',
        resource: 'apollo',
        label: 'delete anything',
      },
    ],
  },
  {
    id: 'team',
    level: 'judgement',
    title: 'running the team',
    brief: 'Priya is taking over the day-to-day team admin.',
    role: 'contractor',
    mode: 'build',
    requirements: [
      {
        type: 'action',
        must: true,
        action: 'people:view',
        resource: 'people',
        label: 'see who is here',
      },
      {
        type: 'action',
        must: true,
        action: 'people:invite',
        resource: 'people',
        label: 'invite someone',
      },
      {
        type: 'action',
        must: true,
        action: 'people:remove',
        resource: 'people',
        label: 'remove someone',
      },
      { type: 'escalation', must: false, label: 'reach owner' },
    ],
  },
  {
    id: 'support',
    level: 'judgement',
    title: 'the support agent',
    brief: 'Marco answers billing questions from customers.',
    role: 'contractor',
    mode: 'build',
    requirements: [
      {
        type: 'action',
        must: true,
        action: 'invoice:view',
        resource: 'invoice',
        label: 'see the invoice',
      },
      {
        type: 'action',
        must: true,
        action: 'people:view',
        resource: 'people',
        label: 'see who is here',
      },
      { type: 'action', must: false, action: 'invoice:pay', resource: 'invoice', label: 'pay it' },
      {
        type: 'action',
        must: false,
        action: 'invoice:refund',
        resource: 'invoice',
        label: 'refund it',
      },
    ],
  },
];

/**
 * What the visitor has built.
 *
 * `scoped` is separate from the action list because it is not a permission —
 * it is a condition on the project grants, the difference between "may edit
 * projects" and "may edit projects they created". Listing it as another
 * checkbox would have made it look like a fourth thing to grant.
 */
export interface Draft {
  readonly actions: readonly string[];
  readonly scoped: boolean;
}

/** What the editor starts with: nothing to build from, or the role as it is. */
export function initialDraft(scenario: Scenario): Draft {
  if (scenario.mode === 'build') return { actions: [], scoped: false };
  return {
    actions: ACTIONS.map((a) => a.id).filter((a) => reachable(scenario.role, a, POLICY)),
    scoped: false,
  };
}

/**
 * The policy with the visitor's grants swapped in for the role they are editing.
 *
 * Only that role's *allows* are replaced. Denials stay: they belong to the
 * organisation rather than to the role, and a visitor who could delete them by
 * unticking a box would be able to grant their way around a block — which is
 * the one thing the model says is impossible.
 */
export function policyFor(scenario: Scenario, draft: Draft): readonly Rule[] {
  const others = POLICY.filter((r) => r.role !== scenario.role || r.effect === 'deny');
  return [
    ...others,
    ...draft.actions.map((action) => ({
      role: scenario.role,
      action,
      effect: 'allow' as const,
      // Only project actions can be scoped: they are the only ones with an
      // owner to compare against.
      ...(draft.scoped && action.startsWith('project:') ? { when: 'mine' as const } : {}),
    })),
  ];
}

export interface Verdict {
  readonly label: string;
  readonly met: boolean;
  /** Why it is not met, in the same plain words the rest of the section uses. */
  readonly note: string;
}

export interface Result {
  readonly verdicts: readonly Verdict[];
  readonly solved: boolean;
  /** Granted but never asked for. */
  readonly extra: readonly string[];
  /** Limits the brief did not state, revealed with the verdict. */
  readonly revealed: number;
}

/**
 * The permissions a correct answer holds.
 *
 * For a build that is simply what the brief asks for. For a fix it is what the
 * role already had, minus what has to go — which is what makes "grant nothing
 * beyond it" mean something in the subtractive direction too, rather than
 * being a rule that only applies to half the scenarios.
 */
export function neededFor(scenario: Scenario): ReadonlySet<string> {
  if (scenario.mode === 'build') {
    return new Set(
      scenario.requirements.flatMap((r) => (r.type === 'action' && r.must ? [r.action] : [])),
    );
  }
  const forbidden = new Set(
    scenario.requirements.flatMap((r) => (r.type === 'action' && !r.must ? [r.action] : [])),
  );
  return new Set(initialDraft(scenario).actions.filter((a) => !forbidden.has(a)));
}

export function grade(scenario: Scenario, draft: Draft): Result {
  const policy = policyFor(scenario, draft);

  const verdicts = scenario.requirements.map((req): Verdict => {
    if (req.type === 'escalation') {
      const found = escalations(policy);
      return {
        label: req.label,
        met: found.length === 0,
        note: found.length > 0 ? found[0]?.role + ' can make themselves owner' : '',
      };
    }
    const resource = RESOURCES[req.resource];
    const decision = resource
      ? evaluate(scenario.role, req.action, resource, policy)
      : { allowed: false, reason: '', term: '', trace: [] };
    const met = decision.allowed === req.must;
    return {
      label: req.label,
      met,
      // A failed must-not has to hint at why it is too broad, not merely restate
      // that it happened. A plain grant covering every resource is the usual
      // cause, and naming that is what points at the fix.
      note: met
        ? ''
        : req.must
          ? decision.reason || 'not granted'
          : decision.reason || 'the grant is not limited to their own',
    };
  });

  const needed = neededFor(scenario);
  const extra = draft.actions.filter((a) => !needed.has(a));

  // `stated` notes extras without failing on them; the harder levels do not.
  const tolerant = scenario.level === 'stated';
  const solved = verdicts.every((v) => v.met) && (tolerant || extra.length === 0);
  const revealed =
    scenario.level === 'judgement' ? scenario.requirements.filter((r) => !r.must).length : 0;

  return { verdicts, solved, extra, revealed };
}

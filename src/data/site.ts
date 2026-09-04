/**
 * Single source of truth for every piece of core content on the site.
 *
 * Nothing here is markup. The human view composes this into elements; the
 * machine view (source view, Phase 2) serialises the same object to JSON. Two
 * renderings of one object — never two copies of the content. If you ever find
 * yourself retyping a string that already lives here, the data model is wrong.
 *
 * Lives in `src/data/` rather than `src/content/` on purpose: `src/content/` is
 * conventionally Astro's content-collections directory, and this is plain typed
 * data, not a collection.
 *
 * Content is drawn from Taha_Manaquib_CV.md. No product or employer names —
 * this site shows no projects (see CLAUDE.md), so achievements appear as
 * evidence of capability rather than as a portfolio of work.
 */

export interface StackGroup {
  /** Short mono heading, e.g. "authorization". */
  readonly label: string;
  readonly items: readonly string[];
}

export interface ContactLink {
  readonly label: string;
  /** What the visitor reads. */
  readonly value: string;
  /** Where it goes. */
  readonly href: string;
}

export interface SiteContent {
  readonly name: string;
  readonly role: string;
  readonly meta: {
    readonly title: string;
    readonly description: string;
  };
  /**
   * Split rather than stored as a sentence so the accent spans can be composed
   * by the view and emitted as a clean array by the JSON view. No HTML in data.
   */
  readonly pitch: {
    readonly lead: string;
    readonly highlights: readonly string[];
  };
  /** Short, scannable evidence. Replaces the About paragraph. */
  readonly proof: readonly string[];
  readonly availability: {
    readonly open: boolean;
    readonly label: string;
  };
  readonly stack: {
    readonly primary: readonly StackGroup[];
    /** Real but secondary — rendered quieter than `primary`. */
    readonly also: readonly string[];
  };
  readonly contact: readonly ContactLink[];
  readonly resumeHref: string;
}

export const site = {
  name: 'Taha Manaquib',
  role: 'Backend-focused Full Stack Engineer',

  meta: {
    title: 'Taha Manaquib — Backend Engineer',
    description:
      'Backend engineer building authorization, billing, and integration systems for ' +
      'multi-tenant SaaS. Node.js, Express, MongoDB.',
  },

  pitch: {
    lead: 'I build the parts of a SaaS product that have to be right',
    highlights: ['authorization', 'billing', 'integrations'],
  },

  proof: [
    'RBAC across 840+ endpoints',
    'OAuth 2.1 server, from scratch',
    'Stripe billing, multi-currency',
  ],

  availability: {
    open: true,
    label: 'Open to remote & contract work',
  },

  stack: {
    primary: [
      { label: 'core', items: ['Node.js', 'Express', 'MongoDB', 'Redis'] },
      {
        label: 'authorization',
        items: ['OAuth 2.0/2.1', 'PKCE', 'JWT', 'RBAC', 'Capability-based', 'Multi-tenant'],
      },
      {
        label: 'scale & jobs',
        items: ['BullMQ', 'Socket.IO', 'Aggregation pipelines', 'Streaming I/O'],
      },
      {
        label: 'billing & ai',
        items: ['Stripe', 'MCP servers', 'OpenAI function calling'],
      },
    ],
    also: ['React', 'Next.js', 'Tailwind', 'Docker', 'CI/CD', 'AWS S3', 'BigQuery'],
  },

  contact: [
    {
      label: 'email',
      value: 'taha.manaquib53@gmail.com',
      href: 'mailto:taha.manaquib53@gmail.com',
    },
    {
      label: 'github',
      value: 'github.com/TahaManaquib',
      href: 'https://github.com/TahaManaquib',
    },
    {
      label: 'linkedin',
      value: 'linkedin.com/in/taha-manaquib',
      href: 'https://www.linkedin.com/in/taha-manaquib/',
    },
  ],

  // TODO(before launch): add the real PDF at `public/taha-resume.pdf`.
  resumeHref: '/taha-resume.pdf',
} as const satisfies SiteContent;

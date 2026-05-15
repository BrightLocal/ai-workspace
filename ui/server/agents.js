import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const WORKSPACE_ROOT = resolve(__dirname, '../../')

const agents = [
  {
    slug: 'context-to-prd',
    name: 'Context to PRD',
    description:
      'Transforms free-form notes, meeting transcripts, or ideas into a structured PRD following the team Confluence template. Runs 4 AI phases: context analysis, metrics review, PRD writing, and feasibility review.',
    longDescription:
      'Paste any unstructured input — a Slack thread, voice memo transcript, one-paragraph idea, or meeting notes. The agent extracts intent, validates metrics, drafts a full PRD, and appends an architect feasibility review. Output is saved as a Markdown file ready to paste into Confluence.',
    inputFields: [
      {
        name: 'featureSlug',
        label: 'Feature slug',
        type: 'text',
        placeholder: 'aggregator-renewals',
        hint: 'Short URL-safe name for this feature. Used as the working directory name.',
        required: true,
        pattern: '^[a-z0-9-]+$',
        patternMessage: 'Lowercase letters, numbers and hyphens only',
      },
      {
        name: 'inputText',
        label: 'Your context',
        type: 'textarea',
        placeholder:
          'Paste meeting notes, a Slack thread, a voice memo transcript, or a one-paragraph idea here...',
        hint: 'Messy input is fine. The agent handles it.',
        required: true,
      },
      {
        name: 'skipMetrics',
        label: 'Skip metrics review phase',
        type: 'checkbox',
        hint: 'Use for investigation/spike PRDs that do not have measurable outcomes yet.',
      },
      {
        name: 'skipFeasibility',
        label: 'Skip feasibility review phase',
        type: 'checkbox',
        hint: 'Use for strategy PRDs that do not propose specific implementation.',
      },
    ],
    requiresAtlassian: false,
    requiresGoogle: false,
    outputPath: (inputs, activeProduct) =>
      `products/${activeProduct}/working/${inputs.featureSlug}/03-prd.md`,
  },
  {
    slug: 'calendar-analyzer',
    name: 'Calendar Analyzer',
    description:
      'Reads your Google Calendar for a day or specific meeting, fetches Gemini meeting notes where available, and produces structured summaries with action items and documentation opportunities.',
    longDescription:
      'Whole-day mode: enter a date ("today", "yesterday", "last Thursday", "2026-05-13") — analyzes all past meetings that have Gemini notes. Single-meeting mode: add the meeting name ("Connected Locations Daily, Wednesday 13 May") — analyzes only that meeting.',
    inputFields: [
      {
        name: 'dateOrQuery',
        label: 'Date or meeting',
        type: 'text',
        placeholder: 'today',
        hint: 'Whole day: enter a date. Specific meeting: add the meeting name before the date.',
        required: true,
        defaultValue: 'today',
        examples: [
          {
            group: 'Whole day',
            items: ['today', 'yesterday', 'last Thursday', '2026-05-13'],
          },
          {
            group: 'Specific meeting',
            items: [
              'Connected Locations Daily, Wednesday 13 May',
              'Backlog Refinement from 2026-05-13',
            ],
          },
        ],
      },
    ],
    requiresAtlassian: false,
    requiresGoogle: true,
    outputPath: () => 'personal/meeting-notes/{date}/',
  },
  {
    slug: 'jira-to-pr',
    name: 'Jira to PR',
    description:
      'Takes a Jira issue key and autonomously drives it to a Pull Request: reads the ticket, researches the codebase, builds an implementation plan, writes code, and opens a PR with a Jira comment.',
    longDescription:
      'Paste a Jira issue key (e.g. BL-1234) or full URL. The agent reads the ticket, clones the relevant repositories, researches the codebase, plans changes file-by-file, implements them, opens a PR, and comments back on Jira with links and risks.',
    inputFields: [
      {
        name: 'jiraKey',
        label: 'Jira issue key or URL',
        type: 'text',
        placeholder: 'BL-1234',
        hint: 'Accepts a key like BL-1234 or a full Jira URL.',
        required: true,
      },
    ],
    requiresAtlassian: true,
    requiresGoogle: false,
    outputPath: (inputs) => `agents/jira-to-pr/workspace/runs/`,
  },
]

export default agents
